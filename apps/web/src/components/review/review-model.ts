/**
 * レビュー画面の表示用の純粋な整形（番号付け・根拠の文言・軸のドットバー・指標の基準）。
 * node --test から直接読むので、"@/..." の別名と React は使わない。
 */
import { AXES, fmtT, type Axis, type Evaluation, type Evidence, type FeedbackItem, type Metrics } from "@lci/core/browser";

export const AXIS_LABEL = Object.fromEntries(AXES.map((a) => [a.id, a.label])) as Record<Axis, string>;
/** 画面に出す軸の短い記号（R1..R8） */
export const axisCode = (a: Axis): string => a.slice(0, 2);

/**
 * 指摘の番号。時刻順に 1 から振り、ピン・一覧・「次の練習」の根拠の 3 か所で同じ番号を使う（04 §4.1、S2-4）。
 * 同時刻は id 順で安定させる。
 */
export function numberFeedback(feedback: FeedbackItem[]): Map<string, number> {
  const sorted = [...feedback].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  return new Map(sorted.map((f, i) => [f.id, i + 1]));
}

/** 時刻の範囲表記。t_end が t より後なら「01:00–03:20」 */
export function fmtRange(t: number, tEnd?: number): string {
  return tEnd != null && tEnd > t ? `${fmtT(t)}–${fmtT(tEnd)}` : fmtT(t);
}

/** 秒数の日本語表記（「2 分 20 秒」「45 秒」） */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} 秒`;
  return r === 0 ? `${m} 分` : `${m} 分 ${r} 秒`;
}

/** 指標名の日本語（根拠・next_practice の based_on に出てくる `metrics.*`） */
export const METRIC_LABEL: Record<string, string> = {
  silence_gt15s: "15 秒超の沈黙",
  run_events: "実行",
  direction_changes: "方針変更",
  phase_estimate: "フェーズ推定",
  lead_time_s: "説明先行",
  silent_edit_ratio: "無発話で編集",
  speech_ratio: "発話比率",
  talking_point_hits: "話すべきポイント",
};

export function metricLabel(name: string): string {
  const key = name.replace(/^metrics\./, "").replace(/\[\d+\]$/, "");
  return METRIC_LABEL[key] ?? key;
}

/** 根拠 1 件の文言。種類を先に、時刻を後に（読み上げても意味が通る順） */
export function describeEvidence(e: Evidence): { kind: string; text: string; t: number | null } {
  switch (e.type) {
    case "transcript":
      return { kind: "発話", text: `「${e.quote}」`, t: e.t0 };
    case "edit":
      return { kind: "編集", text: `${e.file}${e.lines ? ` ${e.lines[0]}–${e.lines[1]} 行` : ""}${e.detail ? ` ${e.detail}` : ""}`, t: e.t };
    case "edit_absence":
      return { kind: "未実装", text: e.symbol, t: null };
    case "metric":
      return { kind: "指標", text: `${metricLabel(e.name)}${e.index != null ? ` #${e.index + 1}` : ""}${e.value ? ` = ${e.value}` : ""}`, t: null };
    case "run":
      return { kind: "実行", text: `${e.run_id}${e.verdict ? ` ${e.verdict}` : ""}`, t: null };
    case "frame":
      return { kind: "画面", text: "", t: e.t };
  }
}

/** 根拠に移動先（seek できる時刻）があるか */
export function evidenceSeekable(e: Evidence, metrics: Metrics | null): boolean {
  switch (e.type) {
    case "transcript":
    case "edit":
    case "frame":
    case "run":
      return true;
    case "metric":
      return metricTime(e, metrics) != null;
    case "edit_absence":
      return false;
  }
}

/** 指標の根拠が指す時刻（沈黙・実行・方針変更の n 件目）。無ければ null */
export function metricTime(e: Extract<Evidence, { type: "metric" }>, metrics: Metrics | null): number | null {
  if (!metrics) return null;
  const i = e.index ?? 0;
  switch (e.name.replace(/^metrics\./, "")) {
    case "silence_gt15s":
      return metrics.silence_gt15s[i]?.t0 ?? null;
    case "run_events":
      return metrics.run_events[i]?.t ?? null;
    case "direction_changes":
      return metrics.direction_changes[i]?.t ?? null;
    default:
      return null;
  }
}

// ---- 軸のドットバー（X7: レーダーの代わり） ----------------------------------

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;
/** 標準（ルーブリックの「3 を標準とする」） */
export const SCORE_BASELINE = 3;

/** 1..5 を [pad, width - pad] に写す */
export function dotBarX(score: number, width: number, pad = 6): number {
  const v = Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
  return pad + ((v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * (width - pad * 2);
}

/** evidence が無い、または confidence が低い項目は「推測」（03 §5.1） */
export function isSpeculative(item: { speculative?: boolean; confidence?: number; evidence?: unknown[] }): boolean {
  if (item.speculative) return true;
  if (item.confidence != null && item.confidence < 0.6) return true;
  if (item.evidence && item.evidence.length === 0) return true;
  return false;
}

export interface AxisRow {
  id: Axis;
  label: string;
  weightPct: number;
  score: number;
  confidence: number;
  speculative: boolean;
  /** 「次の練習」が対象にしている軸（accent で強調する） */
  practice: boolean;
}

/** 軸の並びは AXES の固定順（得点で並べ替えると回ごとの比較ができなくなる） */
export function axisRows(ev: Evaluation): AxisRow[] {
  const practice = new Set(ev.next_practice.map((n) => n.axis));
  return AXES.map((a) => {
    const s = ev.scores[a.id];
    return {
      id: a.id,
      label: a.label,
      weightPct: Math.round(a.weight * 100),
      score: s.score,
      confidence: s.confidence,
      speculative: isSpeculative(s),
      practice: practice.has(a.id),
    };
  });
}

// ---- 指標（決定的計算）と基準 ----------------------------------------------

export interface MetricTile {
  id: string;
  label: string;
  value: string;
  /** 補足（実数の内訳） */
  detail?: string;
  /** ルーブリックが定義している基準（解釈ではなく定義。S2-3） */
  benchmark?: string;
  /** 根拠になる軸 */
  axes: Axis[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function metricTiles(m: Metrics): MetricTile[] {
  const stuck = m.silence_gt15s.filter((s) => !s.editing);
  const silentEditing = m.silence_gt15s.filter((s) => s.editing);
  const runs = m.run_events;
  const design = m.phase_estimate.filter((p) => p.phase === "design").reduce((a, p) => a + (p.t1 - p.t0), 0);
  return [
    {
      id: "silent_edit_ratio",
      label: "無発話で編集",
      value: pct(m.silent_edit_ratio),
      detail: "編集した 10 秒区間のうち発話がない割合",
      benchmark: "目安 20% 未満",
      axes: ["R7_sync"],
    },
    {
      id: "lead_time_s",
      label: "説明先行（中央値）",
      value: m.lead_time_s.median != null ? `${m.lead_time_s.median.toFixed(1)} 秒` : "—",
      detail: `${m.lead_time_s.samples} 標本`,
      benchmark: "5 の状態: 5–30 秒先行",
      axes: ["R7_sync"],
    },
    {
      id: "silence",
      label: "15 秒超の沈黙",
      value: `${m.silence_gt15s.length} 回`,
      detail: `手が止まった ${stuck.length} 回 · 書きながら ${silentEditing.length} 回`,
      benchmark: "手が止まった沈黙は R8、書きながらは R7 の根拠",
      axes: ["R8_attitude", "R7_sync"],
    },
    {
      id: "run_events",
      label: "実行",
      value: `${runs.length} 回`,
      detail: runs.length ? runs.map((r) => `${fmtT(r.t)} ${r.verdict ?? r.mode}`).join(" · ") : "一度も実行していない",
      benchmark: "5 の状態: 区切りごとに実行",
      axes: ["R5_testing"],
    },
    {
      id: "design",
      label: "設計フェーズ",
      value: design > 0 ? fmtDuration(design) : "—",
      detail: "フェーズ推定（発話と編集から）",
      benchmark: "1 の状態: 設計 10 分超",
      axes: ["R6_time"],
    },
    {
      id: "speech_ratio",
      label: "発話比率",
      value: pct(m.speech_ratio),
      detail: `${Math.round(m.speech_total_s)} 秒 / ${Math.round(m.duration_s)} 秒`,
      benchmark: "量は評価しない（説明と実装の同期で見る）",
      axes: [],
    },
  ];
}

/** 要件チェックの集計（「実装あり 2 / 4」） */
export function requirementCounts(list: Evaluation["requirement_checklist"]): { implemented: number; mentioned: number; missing: number; total: number } {
  let implemented = 0;
  let mentioned = 0;
  let missing = 0;
  for (const r of list) {
    if (r.status === "implemented") implemented++;
    else if (r.status === "mentioned_only") mentioned++;
    else missing++;
  }
  return { implemented, mentioned, missing, total: list.length };
}

/** 模範解答比較の要件 ID を、要件チェックや問題の要件ラベルに読み替える（S1-3: mono の ID だけでは対応が取れない） */
export function requirementLabel(id: string, ev: Evaluation | null, problemReqs: { id: string; label: string }[] | undefined): string {
  return ev?.requirement_checklist.find((r) => r.id === id)?.label ?? problemReqs?.find((r) => r.id === id)?.label ?? id;
}
