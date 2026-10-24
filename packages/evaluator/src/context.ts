import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildTimeline,
  editedLinesBetween,
  fmtT,
  loadProblemDir,
  reconstructFileAt,
  type Evaluation,
  type Event,
  type EventOf,
  type Metrics,
  type Problem,
  type Session,
  type SessionStore,
  type Transcript,
  type TranscriptSegment,
} from "@lci/core";
import { readFrameIndex } from "./frames.ts";

/**
 * Claude に渡す「材料」を 1 か所で作る（API 評価と MCP で共有。API_CONTRACT: buildEvaluationContext）。
 * 入力バイト列を決定的にする（同じセッションなら同じ文字列）ことで、再評価の比較と prompt cache を効かせる（03 §8.1）。
 * 時刻はすべて mm:ss（セッション時計）。コードは画面画像からではなくスナップショットのテキストで渡す（03 §6.1）。
 */

export interface ContextFrame {
  t: number;
  reason: string;
  source: "screen" | "cam";
  media_type: "image/jpeg";
  data: string;
}

export interface EvaluationContext {
  session: Session;
  problem: Problem | null;
  metrics: Metrics | null;
  transcript: Transcript | null;
  events: Event[];
  sections: { session: string; problem: string; timeline: string; metrics: string; snapshots: string; runs: string; notes: string };
  /** 画像以外をすべて結合したテキスト */
  text: string;
  frames: ContextFrame[];
  input_digest: Evaluation["input_digest"];
  estimated_tokens: number;
  truncation: string[];
}

export interface BuildContextInput {
  store: SessionStore;
  problemsRoot: string;
  sessionId: string;
  includeFrames?: boolean;
  maxFrames?: number;
  /** 概算トークンの上限（chars / 2.5 + 画像 1 枚 1500） */
  tokenBudget?: number;
}

export function estimateTokens(text: string, frames = 0): number {
  return Math.ceil(text.length / 2.5) + frames * 1500;
}

interface RenderParams {
  maxTranscriptRows: number;
  snapshotLineCap: number;
  referenceLineCap: number;
  maxFrames: number;
}

/** トークン予算超過時に順に適用する縮退段階 */
const LEVELS: { note: string; apply: (p: RenderParams) => void }[] = [
  { note: "画像を 8 枚に削減", apply: (p) => (p.maxFrames = Math.min(p.maxFrames, 8)) },
  { note: "文字起こし行を 250 行に統合", apply: (p) => (p.maxTranscriptRows = Math.min(p.maxTranscriptRows, 250)) },
  { note: "スナップショットを各 200 行に省略", apply: (p) => (p.snapshotLineCap = Math.min(p.snapshotLineCap, 200)) },
  { note: "文字起こし行を 150 行に統合", apply: (p) => (p.maxTranscriptRows = Math.min(p.maxTranscriptRows, 150)) },
  { note: "画像を除外", apply: (p) => (p.maxFrames = 0) },
  { note: "参照解を 100 行に省略", apply: (p) => (p.referenceLineCap = Math.min(p.referenceLineCap, 100)) },
  { note: "スナップショットを各 120 行に省略", apply: (p) => (p.snapshotLineCap = Math.min(p.snapshotLineCap, 120)) },
];

export async function buildEvaluationContext(input: BuildContextInput): Promise<EvaluationContext> {
  const { store, sessionId } = input;
  const session = await store.get(sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);
  const events = await store.readEvents(sessionId);
  const transcript = await store.getTranscript(sessionId);
  const metrics = await store.getMetrics<Metrics>(sessionId);
  let problem: Problem | null = null;
  try {
    problem = await loadProblemDir(input.problemsRoot, session.problem.dir);
  } catch {
    problem = null;
  }
  const refs = problem ? await loadReferenceSolutions(problem, input.problemsRoot) : {};
  const ended_t = session.ended_t ?? (events.length ? events[events.length - 1]!.t : 0);
  const label = (fileId: string) => session.files.find((f) => f.file_id === fileId)?.path ?? fileId;

  // 画像は finalize が作った index から。source が cam のものは allowCamFrames で作られたときだけ存在する
  const allFrames = input.includeFrames === false ? [] : ((await readFrameIndex(store.dir(sessionId)))?.frames ?? []);

  const params: RenderParams = { maxTranscriptRows: 400, snapshotLineCap: 400, referenceLineCap: 300, maxFrames: input.maxFrames ?? 16 };
  const budget = input.tokenBudget ?? 60_000;
  const truncation: string[] = [];

  const speechSegments = (transcript?.segments ?? []).filter((s) => s.text.trim());
  const editEvents = events.filter((e) => e.type === "edit").length;

  const render = async (p: RenderParams) => {
    const segs = mergeSegments(speechSegments, p.maxTranscriptRows);
    const sections = {
      session: sessionSection(session, ended_t),
      problem: problemSection(problem, session, refs, p.referenceLineCap),
      timeline: formatTimeline({ segments: segs, events, ended_t, label }),
      metrics: metrics ? `【指標 metrics（アプリが決定的に計算。数え直さないこと）】\n${JSON.stringify(metrics, null, 1)}` : "【指標 metrics】なし（finalize 未実行）",
      snapshots: await snapshotsSection({ store, session, events, problem, ended_t, lineCap: p.snapshotLineCap, label }),
      runs: await runsSection(store, session, events),
      notes: "",
    };
    const picked = pickEvenly(allFrames, p.maxFrames);
    return { sections, picked, merged: segs.length !== speechSegments.length };
  };

  let r = await render(params);
  let text = joinSections(r.sections, truncation, r.picked);
  let level = 0;
  while (estimateTokens(text, r.picked.length) > budget && level < LEVELS.length) {
    const lv = LEVELS[level++]!;
    const before = JSON.stringify(params);
    lv.apply(params);
    if (JSON.stringify(params) === before) continue;
    truncation.push(lv.note);
    r = await render(params);
    text = joinSections(r.sections, truncation, r.picked);
  }
  if (r.merged && !truncation.some((t) => t.includes("文字起こし"))) truncation.push(`文字起こし ${speechSegments.length} 行を ${params.maxTranscriptRows} 行以下に統合`);
  text = joinSections(r.sections, truncation, r.picked);

  const frames: ContextFrame[] = [];
  for (const f of r.picked) {
    try {
      const data = (await fs.readFile(path.join(store.dir(sessionId), f.file))).toString("base64");
      frames.push({ t: f.t, reason: f.reason, source: f.source, media_type: "image/jpeg", data });
    } catch {
      /* 欠けたフレームは飛ばす */
    }
  }

  return {
    session,
    problem,
    metrics,
    transcript,
    events,
    sections: r.sections,
    text,
    frames,
    input_digest: {
      transcript_segments: speechSegments.length,
      edit_events: editEvents,
      frames: frames.length,
      metrics_version: metrics?.metrics_version ?? "1",
    },
    estimated_tokens: estimateTokens(text, frames.length),
    truncation,
  };
}

function joinSections(sections: EvaluationContext["sections"], truncation: string[], frames: { t: number; reason: string }[]): string {
  const notes: string[] = [];
  if (truncation.length) notes.push(`入力は予算内に収めるため次の省略を行った: ${truncation.join("、")}`);
  if (frames.length) notes.push(`画面キーフレーム ${frames.length} 枚を末尾に添付（${frames.map((f) => `${fmtT(f.t)} ${f.reason}`).join(" / ")}）。コードは画像から読み取らず、スナップショットのテキストを正とすること`);
  else notes.push("画面キーフレームなし（編集ログとスナップショットのみで判断）");
  sections.notes = `【備考】\n${notes.map((n) => `- ${n}`).join("\n")}`;
  return [sections.session, sections.problem, sections.timeline, sections.metrics, sections.snapshots, sections.runs, sections.notes].join("\n\n");
}

function sessionSection(s: Session, ended_t: number): string {
  const lines = [
    `【セッション】`,
    `- session_id: ${s.session_id}`,
    `- 問題: ${s.problem.id} ${s.problem.title}（制限 ${Math.round(s.problem.time_limit_sec / 60)} 分）`,
    `- 言語: ${s.problem.language}`,
    `- 長さ: ${fmtT(ended_t)}（終了理由: ${s.end_reason ?? "不明"}）`,
    `- 録画: ${s.recorders.map((r) => `${r.id}(${r.kind}${r.media_duration_ms ? ` ${fmtT(r.media_duration_ms)}` : ""})`).join(", ") || "なし"}`,
    `- 文字起こし: ${s.stt ? `${s.stt.status}${s.stt.error ? ` — ${s.stt.error}` : ""}` : "未実行"}`,
  ];
  const w = s.warnings.filter((x) => !["remux_skipped", "scale_out_of_range"].includes(x.code));
  if (w.length) lines.push(`- 警告: ${w.map((x) => `${x.code}${x.detail ? `(${x.detail.slice(0, 60)})` : ""}`).join(", ")}`);
  return lines.join("\n");
}

function numbered(text: string, cap: number): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const fmt = (l: string, i: number) => `${String(i + 1).padStart(4, " ")}| ${l}`;
  if (lines.length <= cap) return lines.map(fmt).join("\n");
  const head = Math.floor(cap * 0.75);
  const tail = cap - head;
  return [
    ...lines.slice(0, head).map(fmt),
    `     … (${lines.length - head - tail} 行省略) …`,
    ...lines.slice(lines.length - tail).map((l, i) => fmt(l, lines.length - tail + i)),
  ].join("\n");
}

function problemSection(p: Problem | null, s: Session, refs: Record<string, string>, referenceLineCap: number): string {
  if (!p) return `【問題】${s.problem.id} ${s.problem.title}（問題ファイルを読めなかったため本文なし）`;
  const m = p.meta;
  const out: string[] = [];
  out.push(`【問題】${m.id} ${m.title}（${m.category} / ${m.difficulty} / ${m.time_limit} 分 / 面接官モード ${m.interviewer_mode}）`);
  out.push(`## 問題文\n${p.body.statement}`);
  if (p.body.constraints) out.push(`## 制約\n${p.body.constraints}`);
  out.push(`## 要件チェックリスト（requirement_checklist はこの id をそのまま使うこと）\n${m.requirements.map((r) => `- ${r.id}: ${r.label}`).join("\n") || "- （定義なし）"}`);
  out.push(`## 想定トークポイント talking_points\n${m.talking_points.map((t) => `- ${t.id} (weight ${t.weight}): ${t.text}`).join("\n") || "- （定義なし）"}`);
  const h = m.rubric_hints;
  const hints: string[] = [];
  if (h.correctness) hints.push(`- correctness: ${h.correctness}`);
  if (h.explanation) hints.push(`- explanation: ${h.explanation}`);
  if (h.time_management) hints.push(`- time_management: ${h.time_management}`);
  if (h.red_flags.length) hints.push(`- red_flags: ${h.red_flags.join(" / ")}`);
  if (h.checklist.length) hints.push(`- checklist: ${h.checklist.join(" / ")}`);
  if (hints.length) out.push(`## 採点ヒント rubric_hints\n${hints.join("\n")}`);
  if (p.body.interviewer_notes) out.push(`## 面接官メモ（非公開。受験者には見えていない）\n${p.body.interviewer_notes}`);
  if (p.body.review_notes) out.push(`## 想定解答方針（振り返り用解説）\n${p.body.review_notes}`);
  if (p.tests.kind === "web" && p.tests.rubricHints.length) out.push(`## 判定シナリオの観点\n${p.tests.rubricHints.join(", ")}`);
  const ref = pickReference(refs, s.problem.language);
  if (ref) out.push(`## 参照解（${ref.lang}）— 比較用。別解を「未実装」と誤判定しないこと\n${numbered(ref.text, referenceLineCap)}`);
  return out.join("\n\n");
}

/** loadProblemDir は reference_solutions のパスしか持たないので、本文をここで読む */
export async function loadReferenceSolutions(problem: Problem, problemsRoot: string): Promise<Record<string, string>> {
  const refs: Record<string, string> = {};
  for (const [lang, rel] of Object.entries(problem.meta.reference_solutions)) {
    try {
      refs[lang] = await fs.readFile(path.join(problemsRoot, problem.dir, rel), "utf8");
    } catch {
      /* 無い言語は飛ばす */
    }
  }
  return refs;
}

function pickReference(refs: Record<string, string>, lang: string): { lang: string; text: string } | null {
  const key = refs[lang] !== undefined ? lang : Object.keys(refs)[0];
  return key !== undefined && refs[key] !== undefined ? { lang: key, text: refs[key] } : null;
}

/** 行数上限に収まるまで隣接セグメントを統合する（発話のみ） */
export function mergeSegments(speech: TranscriptSegment[], maxRows: number): TranscriptSegment[] {
  let segs = [...speech].sort((a, b) => a.t_start - b.t_start);
  while (segs.length > maxRows) {
    const next: TranscriptSegment[] = [];
    for (let i = 0; i < segs.length; i += 2) {
      const a = segs[i]!;
      const b = segs[i + 1];
      if (!b) {
        next.push(a);
        continue;
      }
      next.push({
        ...a,
        end_ms: b.end_ms,
        t_end: b.t_end,
        text: `${a.text} ${b.text}`,
        is_filler: a.is_filler && b.is_filler,
        words: [],
      });
    }
    segs = next;
  }
  return segs;
}

export interface TimelineInput {
  segments: TranscriptSegment[];
  events: Event[];
  ended_t: number;
  label: (fileId: string) => string;
}

/** 発話行＋無発話区間の編集要約＋実行/タブ離脱などの離散イベントを時刻順に 1 本のテキストにする */
export function formatTimeline({ segments, events, ended_t, label }: TimelineInput): string {
  const speech = segments.filter((s) => s.text.trim()).sort((a, b) => a.t_start - b.t_start);
  const rows: { t: number; order: number; line: string }[] = [];
  const edits = events.filter((e): e is EventOf<"edit"> => e.type === "edit");

  const editInfo = (t0: number, t1: number): string => {
    const inRange = edits.filter((e) => e.t >= t0 && e.t <= t1);
    if (!inRange.length) return "";
    const files = [...new Set(inRange.map((e) => e.file))];
    const first = files[0]!;
    const lines = editedLinesBetween(events, first, t0, t1);
    const added = inRange.reduce((a, e) => a + e.changes.reduce((x, c) => x + c.text.length, 0), 0);
    const deleted = inRange.reduce((a, e) => a + e.changes.reduce((x, c) => x + c.rangeLength, 0), 0);
    return `編集 ${inRange.length} 件 ${label(first)}${lines ? ` L${lines[0]}-${lines[1]}` : ""}${files.length > 1 ? ` 他${files.length - 1}` : ""} (+${added}/-${deleted}字)`;
  };

  const tl = buildTimeline(speech, events);
  tl.forEach((row, i) => {
    const seg = speech[i]!;
    const info = editInfo(row.t_start, row.t_end);
    const focus = row.focus ? ` @${row.focus}` : "";
    rows.push({ t: row.t_start, order: 1, line: `[${fmtT(row.t_start)}–${fmtT(row.t_end)}] ${seg.text}${info || focus ? `  ｜${info}${focus}` : ""}` });
  });

  // 無発話区間（10 秒以上）: 編集があれば要約、無ければ「編集なし」
  let cursor = 0;
  const gapRow = (t0: number, t1: number) => {
    const sec = Math.round((t1 - t0) / 1000);
    const info = editInfo(t0, t1);
    rows.push({ t: t0, order: 0, line: `[${fmtT(t0)}–${fmtT(t1)}] （無発話 ${sec}s｜${info || "編集なし"}）` });
  };
  if (speech.length) {
    for (const s of speech) {
      if (s.t_start - cursor >= 10_000) gapRow(cursor, s.t_start);
      cursor = Math.max(cursor, s.t_end);
    }
    if (ended_t - cursor >= 10_000) gapRow(cursor, ended_t);
  } else {
    // 文字起こしが無いときは 30 秒ビンの編集量だけ
    for (let t0 = 0; t0 < ended_t; t0 += 30_000) {
      const t1 = Math.min(ended_t, t0 + 30_000);
      const info = editInfo(t0, t1);
      rows.push({ t: t0, order: 0, line: `[${fmtT(t0)}–${fmtT(t1)}] （文字起こしなし｜${info || "編集なし"}）` });
    }
  }

  for (const e of events) {
    switch (e.type) {
      case "run":
        rows.push({ t: e.t, order: 2, line: `[${fmtT(e.t)}] ▶ 実行 ${e.mode}${e.verdict ? ` verdict=${e.verdict}` : ""}${e.exit_code !== undefined ? ` exit=${e.exit_code}` : ""} (run_id ${e.run_id})` });
        break;
      case "visibility":
        rows.push({ t: e.t, order: 2, line: `[${fmtT(e.t)}] ${e.state === "hidden" ? "⤴ タブ離脱" : "⤵ タブ復帰"}` });
        break;
      case "paste":
        rows.push({ t: e.t, order: 2, line: `[${fmtT(e.t)}] 貼り付け ${e.chars} 文字 (${label(e.file)})` });
        break;
      case "followup_shown":
        rows.push({ t: e.t, order: 2, line: `[${fmtT(e.t)}] 面接官の追問表示: ${e.text}` });
        break;
      case "marker":
        rows.push({ t: e.t, order: 2, line: `[${fmtT(e.t)}] マーカー: ${e.label}` });
        break;
      default:
        break;
    }
  }
  rows.sort((a, b) => a.t - b.t || a.order - b.order);
  const header = speech.length
    ? `【タイムライン】発話は [mm:ss–mm:ss] 原文。｜以降は同時間帯の編集要約。（無発話 …）は 10 秒以上発話が無い区間。発話 ${speech.length} 行、編集 ${edits.length} 件、長さ ${fmtT(ended_t)}`
    : `【タイムライン】文字起こしなし。30 秒ごとの編集量のみ（編集 ${edits.length} 件、長さ ${fmtT(ended_t)}）`;
  return `${header}\n${rows.map((r) => r.line).join("\n")}`;
}

async function snapshotsSection(input: {
  store: SessionStore;
  session: Session;
  events: Event[];
  problem: Problem | null;
  ended_t: number;
  lineCap: number;
  label: (fileId: string) => string;
}): Promise<string> {
  const { store, session, events, problem, ended_t, lineCap, label } = input;
  const fileIds = session.files.length
    ? session.files.map((f) => f.file_id)
    : [...new Set(events.flatMap((e) => ("file" in e && typeof e.file === "string" ? [e.file] : [])))];
  if (!fileIds.length) return "【コードスナップショット】編集されたファイルなし";
  const resolver = { read: (ref: string) => store.readRel(session.session_id, ref) };
  const out: string[] = ["【コードスナップショット】経過 25% / 50% / 75% / 100% 時点の全文（行番号付き。code_ref.lines はこの行番号、at はその時刻の秒）"];
  for (const fid of fileIds) {
    const p = label(fid);
    const starter = problem?.meta.starter_files.find((sf) => sf.path === p)?.content ?? "";
    let prev: string | null = null;
    for (const frac of [0.25, 0.5, 0.75, 1]) {
      const t = Math.round(ended_t * frac);
      let text: string;
      let version: number;
      try {
        ({ text, version } = await reconstructFileAt(events, fid, t, resolver, starter));
      } catch (e) {
        out.push(`### ${p} @ ${fmtT(t)} (${frac * 100}%) — 復元失敗: ${(e as Error).message}`);
        continue;
      }
      const head = `### ${p} @ ${fmtT(t)} (${frac * 100}%, at=${Math.round(t / 1000)}s, version ${version})`;
      if (prev !== null && prev === text) out.push(`${head} — 直前のスナップショットと同一`);
      else out.push(`${head}\n${numbered(text, lineCap)}`);
      prev = text;
    }
  }
  return out.join("\n\n");
}

async function runsSection(store: SessionStore, session: Session, events: Event[]): Promise<string> {
  const runs = events.filter((e): e is EventOf<"run"> => e.type === "run");
  if (!runs.length) return "【実行結果】実行なし（一度も実行していない）";
  const out: string[] = [`【実行結果】${runs.length} 回`];
  for (const e of runs) {
    const r = await store.getRun(session.session_id, e.run_id);
    const base = `- [${fmtT(e.t)}] ${e.mode} run_id=${e.run_id}`;
    if (!r) {
      out.push(`${base} verdict=${e.verdict ?? "?"} exit=${e.exit_code ?? "?"}（詳細ファイルなし）`);
      continue;
    }
    const pass = r.cases.filter((c) => c.verdict === "AC" || c.verdict === "PASS").length;
    const failed = r.cases.filter((c) => !(c.verdict === "AC" || c.verdict === "PASS")).map((c) => `${c.name}:${c.verdict}${c.message ? `(${c.message.slice(0, 80)})` : ""}`);
    const parts = [`verdict=${r.verdict}`, r.exit_code !== undefined ? `exit=${r.exit_code}` : "", `${r.duration_ms}ms`];
    if (r.cases.length) parts.push(`cases ${pass}/${r.cases.length} pass${failed.length ? ` 失敗: ${failed.join(", ")}` : ""}`);
    if (r.compile && !r.compile.ok) parts.push(`コンパイルエラー: ${r.compile.stderr.slice(0, 200)}`);
    if (r.stderr?.trim()) parts.push(`stderr: ${r.stderr.trim().slice(0, 300)}`);
    if (r.behavior) {
      const by: Record<string, number> = {};
      for (const q of r.behavior.requests) by[q.status] = (by[q.status] ?? 0) + 1;
      parts.push(`requests ${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(" ")}${r.behavior.techniques.length ? ` techniques=${r.behavior.techniques.join(",")}` : ""}`);
    }
    out.push(`${base} ${parts.filter(Boolean).join(" ")}`);
  }
  return out.join("\n");
}

function pickEvenly<T>(xs: T[], n: number): T[] {
  if (n <= 0 || !xs.length) return [];
  if (xs.length <= n) return xs;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(xs[Math.floor((i * (xs.length - 1)) / (n - 1))]!);
  return [...new Set(out)];
}
