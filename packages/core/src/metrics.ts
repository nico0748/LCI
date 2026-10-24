import type { Event, EventOf, TranscriptSegment } from "./session.ts";
import type { ProblemMeta } from "./problem.ts";
import { Metrics } from "./evaluation.ts";

/**
 * セッション指標の決定的計算（要件書 03 §2.3）。
 * LLM に数えさせない。ここで出した数値を Claude は解釈するだけ。
 */

const SILENCE_THRESHOLD_MS = 15_000;
const EDIT_WINDOW_MS = 5_000;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))));
  return s[i]!;
}

/** 発話セグメント列から沈黙区間を求める（text が空のセグメントも沈黙として扱う） */
export function silences(segments: TranscriptSegment[], t_end: number): { t0: number; t1: number }[] {
  const speech = segments.filter((s) => s.text.trim()).sort((a, b) => a.t_start - b.t_start);
  const out: { t0: number; t1: number }[] = [];
  let cursor = 0;
  for (const s of speech) {
    if (s.t_start - cursor >= SILENCE_THRESHOLD_MS) out.push({ t0: cursor, t1: s.t_start });
    cursor = Math.max(cursor, s.t_end);
  }
  if (t_end - cursor >= SILENCE_THRESHOLD_MS) out.push({ t0: cursor, t1: t_end });
  return out;
}

function hasEditBetween(edits: EventOf<"edit">[], t0: number, t1: number): boolean {
  return edits.some((e) => e.t >= t0 && e.t <= t1);
}

/** 文字起こし中の用語一致で talking_points 言及を検出する。語彙は text を空白・読点で分割して使う */
export function detectTalkingPoints(meta: ProblemMeta, segments: TranscriptSegment[]) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const out: Metrics["talking_point_hits"] = [];
  for (const tp of meta.talking_points) {
    const terms = extractTerms(tp.text);
    let hit: { t: number; quote: string; matched: string[] } | null = null;
    for (const s of segments) {
      const n = norm(s.text);
      const matched = terms.filter((t) => n.includes(norm(t)));
      // 英数字の専門語 1 つ、または日本語語彙が 2 つ以上かつ語彙の半数以上一致で言及とみなす
      const strong = matched.filter((m) => /[a-z]/i.test(m));
      if (strong.length >= 1 || (matched.length >= 2 && matched.length * 2 >= terms.length)) {
        hit = { t: s.t_start, quote: s.text, matched };
        break;
      }
    }
    out.push({ id: tp.id, t: hit?.t ?? null, quote: hit?.quote ?? null, matched_terms: hit?.matched ?? [] });
  }
  return out;
}

/** talking_point の文から検出用語彙を取り出す（英数字トークンとカタカナ・漢字の連続） */
export function extractTerms(text: string): string[] {
  const stop = new Set(["する", "こと", "もの", "ため", "よう", "ない", "から", "まで", "場合", "とき", "必須", "担保", "回避", "可能", "必要", "説明", "言及", "できる"]);
  const tokens = text.match(/[A-Za-z][A-Za-z0-9_.]{1,}|[ァ-ヶー]{2,}|[一-龠]{2,}/g) ?? [];
  return [...new Set(tokens.filter((t) => !stop.has(t)))];
}

export interface MetricsInput {
  events: Event[];
  segments: TranscriptSegment[];
  meta: ProblemMeta;
  ended_t: number;
}

export function computeMetrics({ events, segments, meta, ended_t }: MetricsInput): Metrics {
  const edits = events.filter((e): e is EventOf<"edit"> => e.type === "edit");
  const speech = segments.filter((s) => s.text.trim());
  const speech_total = speech.reduce((a, s) => a + (s.t_end - s.t_start), 0);

  // lead time: 各発話セグメントの開始から、その後 60 秒以内の最初の編集までの秒数
  const leads: number[] = [];
  for (const s of speech) {
    const next = edits.find((e) => e.t >= s.t_start && e.t <= s.t_start + 60_000);
    if (next) leads.push((next.t - s.t_start) / 1000);
  }

  const sil = silences(segments, ended_t).map((r) => ({
    ...r,
    dur_s: Math.round((r.t1 - r.t0) / 100) / 10,
    editing: hasEditBetween(edits, r.t0, r.t1),
  }));

  // 無発話編集: 各編集について前後 EDIT_WINDOW 内に発話がなければ無発話編集
  let silentEdits = 0;
  for (const e of edits) {
    const talking = speech.some((s) => s.t_end >= e.t - EDIT_WINDOW_MS && s.t_start <= e.t + EDIT_WINDOW_MS);
    if (!talking) silentEdits++;
  }

  // 方針変更: 1 イベントで 200 文字超の削除、または undo 連打（5 秒以内に 5 回以上）
  const direction_changes: Metrics["direction_changes"] = [];
  let undoWindow: number[] = [];
  for (const e of edits) {
    const deleted = e.changes.reduce((a, c) => a + c.rangeLength, 0);
    const added = e.changes.reduce((a, c) => a + c.text.length, 0);
    if (deleted - added > 200) direction_changes.push({ t: e.t, kind: "large_delete", detail: `${deleted} 文字削除` });
    if (e.undo) {
      undoWindow = undoWindow.filter((t) => e.t - t <= 5000);
      undoWindow.push(e.t);
      if (undoWindow.length === 5) direction_changes.push({ t: e.t, kind: "undo_burst", detail: "5 秒以内に undo 5 回" });
    }
  }
  const verbalRe = /(やっぱり|やめて|方針を変え|作り直|書き直|違いますね|間違えま)/;
  for (const s of speech) if (verbalRe.test(s.text)) direction_changes.push({ t: s.t_start, kind: "verbal", detail: s.text.slice(0, 40) });
  direction_changes.sort((a, b) => a.t - b.t);

  const run_events = events
    .filter((e): e is EventOf<"run"> => e.type === "run")
    .map((e) => ({ t: e.t, mode: e.mode, verdict: e.verdict }));

  // フェーズ推定: 最初の編集までを design、最後の run 以降で編集が少なければ polish、run の前後 30 秒を verify
  const phase_estimate: Metrics["phase_estimate"] = [];
  const firstEdit = edits[0]?.t ?? ended_t;
  if (firstEdit > 0) phase_estimate.push({ phase: "design", t0: 0, t1: firstEdit });
  let cursor = firstEdit;
  for (const r of run_events) {
    if (r.t - 30_000 > cursor) phase_estimate.push({ phase: "implement", t0: cursor, t1: r.t - 30_000 });
    phase_estimate.push({ phase: "verify", t0: Math.max(cursor, r.t - 30_000), t1: Math.min(ended_t, r.t + 30_000) });
    cursor = Math.min(ended_t, r.t + 30_000);
  }
  if (cursor < ended_t) {
    const tailEdits = edits.filter((e) => e.t >= cursor).length;
    phase_estimate.push({ phase: tailEdits > 0 && tailEdits < 20 ? "polish" : tailEdits === 0 ? "idle" : "implement", t0: cursor, t1: ended_t });
  }

  const fillerRe = /^(えー|えっと|あの|その|まあ|うーん|んー)+$/;
  const fillers = speech.filter((s) => fillerRe.test(s.text.replace(/[、。\s]/g, ""))).length;

  let hidden_ms = 0;
  let hiddenSince: number | null = null;
  for (const e of events) {
    if (e.type === "visibility") {
      if (e.state === "hidden") hiddenSince = e.t;
      else if (hiddenSince !== null) {
        hidden_ms += e.t - hiddenSince;
        hiddenSince = null;
      }
    }
  }

  return Metrics.parse({
    metrics_version: "1",
    duration_s: Math.round(ended_t / 1000),
    speech_total_s: Math.round(speech_total / 1000),
    speech_ratio: ended_t ? Math.round((speech_total / ended_t) * 100) / 100 : 0,
    edit_total_events: edits.length,
    lead_time_s: { median: median(leads), p25: quantile(leads, 0.25), p75: quantile(leads, 0.75), samples: leads.length },
    silence_gt15s: sil,
    silent_edit_ratio: edits.length ? Math.round((silentEdits / edits.length) * 100) / 100 : 0,
    direction_changes,
    run_events,
    phase_estimate,
    talking_point_hits: detectTalkingPoints(meta, segments),
    restatements: direction_changes.filter((d) => d.kind === "verbal").length,
    filler_rate: speech.length ? Math.round((fillers / speech.length) * 100) / 100 : 0,
    paste_events: events.filter((e) => e.type === "paste").length,
    visibility_hidden_s: Math.round(hidden_ms / 1000),
  });
}
