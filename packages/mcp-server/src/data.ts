import { promises as fs } from "node:fs";
import path from "node:path";
import {
  editedLinesBetween,
  fmtT,
  loadAllProblems,
  loadProblemDir,
  reconstructFileAt,
  type Event,
  type EventOf,
  type Metrics,
  type Problem,
  type Session,
  type SessionStore,
  type TranscriptSegment,
} from "@lci/core";
import { loadReferenceSolutions, readFrameIndex } from "@lci/evaluator";

/**
 * MCP ツールが返すデータの組み立て。Resource と Tool は同じ関数を使う（03 §4.3）。
 * MCP 上の時刻は「経過秒」（評価 JSON の draft と同じ単位）。表示用に mm:ss も併記する。
 */

export const sec = (ms: number) => Math.round(ms / 100) / 10;

export async function requireSession(store: SessionStore, id: string): Promise<Session> {
  const s = await store.get(id);
  if (!s) throw new Error(`セッションが見つかりません: ${id}（list_sessions で ID を確認してください）`);
  return s;
}

export function endedT(s: Session, events: Event[]): number {
  return s.ended_t ?? (events.length ? events[events.length - 1]!.t : 0);
}

export function fileLabel(s: Session, fileId: string): string {
  return s.files.find((f) => f.file_id === fileId)?.path ?? fileId;
}

export function fileIdOf(s: Session, events: Event[], fileOrPath?: string): string[] {
  const ids = s.files.length ? s.files.map((f) => f.file_id) : [...new Set(events.flatMap((e) => ("file" in e && typeof e.file === "string" ? [e.file] : [])))];
  if (!fileOrPath) return ids;
  const hit = s.files.find((f) => f.file_id === fileOrPath || f.path === fileOrPath);
  return hit ? [hit.file_id] : ids.filter((i) => i === fileOrPath);
}

export async function loadProblemFor(problemsRoot: string, s: Session): Promise<Problem | null> {
  try {
    return await loadProblemDir(problemsRoot, s.problem.dir);
  } catch {
    const all = await loadAllProblems(problemsRoot).catch(() => [] as Problem[]);
    return all.find((p) => p.meta.id === s.problem.id) ?? null;
  }
}

export function numbered(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l, i) => `${String(i + 1).padStart(4, " ")}| ${l}`)
    .join("\n");
}

export async function codeAt(store: SessionStore, s: Session, events: Event[], problem: Problem | null, fileId: string, t: number) {
  const p = fileLabel(s, fileId);
  const starter = problem?.meta.starter_files.find((sf) => sf.path === p)?.content ?? "";
  const resolver = { read: (ref: string) => store.readRel(s.session_id, ref) };
  return { path: p, file_id: fileId, ...(await reconstructFileAt(events, fileId, t, resolver, starter)) };
}

export async function runSummaries(store: SessionStore, s: Session, events: Event[]) {
  const runs = events.filter((e): e is EventOf<"run"> => e.type === "run");
  const out = [];
  for (const e of runs) {
    const r = await store.getRun(s.session_id, e.run_id);
    out.push({
      run_id: e.run_id,
      t: sec(e.t),
      at: fmtT(e.t),
      mode: e.mode,
      verdict: r?.verdict ?? e.verdict ?? null,
      exit_code: r?.exit_code ?? e.exit_code ?? null,
      cases: r?.cases.map((c) => ({ name: c.name, verdict: c.verdict, message: c.message?.slice(0, 200) })) ?? [],
      stderr: r?.stderr?.slice(0, 500) ?? null,
      requests: r?.behavior ? r.behavior.requests.reduce<Record<string, number>>((a, q) => ((a[q.status] = (a[q.status] ?? 0) + 1), a), {}) : null,
    });
  }
  return out;
}

export async function sessionOverview(store: SessionStore, problemsRoot: string, id: string) {
  const s = await requireSession(store, id);
  const events = await store.readEvents(id);
  const ended = endedT(s, events);
  const problem = await loadProblemFor(problemsRoot, s);
  const metrics = await store.getMetrics<Metrics>(id);
  const transcript = await store.getTranscript(id);
  const final = [];
  for (const fid of fileIdOf(s, events)) {
    const c = await codeAt(store, s, events, problem, fid, ended);
    final.push({ path: c.path, file_id: fid, version: c.version, code: numbered(c.text) });
  }
  return {
    session_id: s.session_id,
    status: s.status,
    problem: { id: s.problem.id, title: s.problem.title, dir: s.problem.dir, time_limit_sec: s.problem.time_limit_sec, statement: problem?.body.statement ?? null, constraints: problem?.body.constraints ?? null },
    language: s.problem.language,
    started_at_wall: s.started_at_wall,
    duration_s: sec(ended),
    duration: fmtT(ended),
    end_reason: s.end_reason ?? null,
    stt: s.stt ?? null,
    transcript_segments: transcript?.segments.filter((x) => x.text.trim()).length ?? 0,
    edit_events: events.filter((e) => e.type === "edit").length,
    frames: s.finalize?.frames ?? 0,
    warnings: s.warnings,
    final_code: final,
    runs: await runSummaries(store, s, events),
    metrics,
    evaluations: s.evaluations.length,
    note: "時刻はすべて経過秒（セッション開始=0）。final_code は行番号付き（code_ref.lines はこの番号）。",
  };
}

const PLAN_RE = /(まず|次に|最初に|方針|手順|①|②|③|していきます|やります|実装します)/;
const QUESTION_RE = /(でいいですか|ですかね|と仮定|仮定し|想定し|前提|質問)/;
const RESTATE_RE = /(あ、違|じゃなくて|ではなく|やっぱり|間違え|訂正)/;

export function markersOf(text: string): string[] {
  const m: string[] = [];
  if (PLAN_RE.test(text)) m.push("plan");
  if (QUESTION_RE.test(text)) m.push("question");
  if (RESTATE_RE.test(text)) m.push("restatement");
  return m;
}

/** avg_logprob から confidence 近似（0–1）。無ければ null */
export function confidenceOf(s: TranscriptSegment): number | null {
  return s.avg_logprob === undefined ? null : Math.round(Math.exp(s.avg_logprob) * 100) / 100;
}

export async function transcriptRows(store: SessionStore, id: string, t0s?: number, t1s?: number) {
  const tr = await store.getTranscript(id);
  if (!tr) return { available: false, rows: [] as unknown[], note: "文字起こしがありません（finalize 未実行か whisper 未設定）" };
  const lo = (t0s ?? 0) * 1000;
  const hi = t1s === undefined ? Infinity : t1s * 1000;
  const rows = tr.segments
    .filter((s) => s.text.trim() && s.t_end >= lo && s.t_start <= hi)
    .map((s) => ({ t0: sec(s.t_start), t1: sec(s.t_end), at: `${fmtT(s.t_start)}–${fmtT(s.t_end)}`, text: s.text, confidence: confidenceOf(s), markers: markersOf(s.text) }));
  return { available: true, engine: tr.engine, rows };
}

export function transcriptText(rows: { at: string; text: string }[]): string {
  return rows.map((r) => `[${r.at}] ${r.text}`).join("\n");
}

/** 10 秒ビン（granularity 可変）のタイムライン。ページングする */
export async function timelineBins(store: SessionStore, id: string, opts: { t0?: number; t1?: number; granularity_s?: number; page?: number; page_size?: number }) {
  const s = await requireSession(store, id);
  const events = await store.readEvents(id);
  const ended = endedT(s, events);
  const tr = await store.getTranscript(id);
  const speech = (tr?.segments ?? []).filter((x) => x.text.trim());
  const g = Math.max(1, opts.granularity_s ?? 10) * 1000;
  const lo = Math.max(0, (opts.t0 ?? 0) * 1000);
  const hi = Math.min(ended, opts.t1 === undefined ? ended : opts.t1 * 1000);
  const metrics = await store.getMetrics<Metrics>(id);
  const bins = [];
  for (let b0 = Math.floor(lo / g) * g; b0 < hi; b0 += g) {
    const b1 = b0 + g;
    let chars = 0;
    for (const sg of speech) {
      const ov = Math.min(b1, sg.t_end) - Math.max(b0, sg.t_start);
      if (ov > 0) chars += Math.round(sg.text.length * (ov / Math.max(1, sg.t_end - sg.t_start)));
    }
    const edits = events.filter((e): e is EventOf<"edit"> => e.type === "edit" && e.t >= b0 && e.t < b1);
    const editLines = edits.reduce((a, e) => a + e.changes.reduce((x, c) => x + Math.max(1, c.text.split("\n").length - 1, c.range[2] - c.range[0]), 0), 0);
    const files = [...new Set(edits.map((e) => fileLabel(s, e.file)))];
    const run = events.find((e): e is EventOf<"run"> => e.type === "run" && e.t >= b0 && e.t < b1);
    const silence = (metrics?.silence_gt15s ?? []).some((x) => x.t0 < b1 && x.t1 > b0);
    bins.push({
      t: sec(b0),
      at: fmtT(b0),
      speech_chars: chars,
      edit_events: edits.length,
      edit_lines: editLines,
      files_touched: files,
      ...(run ? { run: { run_id: run.run_id, mode: run.mode, verdict: run.verdict ?? null } } : {}),
      ...(silence ? { silence: true } : {}),
    });
  }
  const pageSize = Math.max(10, Math.min(500, opts.page_size ?? 120));
  const page = Math.max(1, opts.page ?? 1);
  const slice = bins.slice((page - 1) * pageSize, page * pageSize);
  return { session_id: id, granularity_s: g / 1000, duration_s: sec(ended), page, pages: Math.max(1, Math.ceil(bins.length / pageSize)), total_bins: bins.length, bins: slice };
}

/** 編集ログの要約（diff 本文は 200 文字で切る） */
export async function editLog(store: SessionStore, id: string, opts: { t0: number; t1: number; file?: string; page?: number; page_size?: number }) {
  const s = await requireSession(store, id);
  const events = await store.readEvents(id);
  const lo = opts.t0 * 1000;
  const hi = opts.t1 * 1000;
  const want = opts.file ? new Set(fileIdOf(s, events, opts.file)) : null;
  const rows = [];
  for (const e of events) {
    if (e.t < lo || e.t > hi) continue;
    if (e.type === "edit") {
      if (want && !want.has(e.file)) continue;
      const ins = e.changes.reduce((a, c) => a + c.text.length, 0);
      const del = e.changes.reduce((a, c) => a + c.rangeLength, 0);
      const kind = del && ins ? "replace" : del ? "delete" : "insert";
      const c0 = e.changes[0];
      const text = e.changes.map((c) => c.text).join(" ⏎ ");
      rows.push({
        t: sec(e.t),
        at: fmtT(e.t),
        file: fileLabel(s, e.file),
        range: c0 ? c0.range : null,
        kind: e.undo ? `${kind}(undo)` : kind,
        inserted: ins,
        deleted: del,
        summary: text.length > 200 ? `${text.slice(0, 200)}…` : text,
      });
    } else if (e.type === "paste" || e.type === "run" || e.type === "focus" || e.type === "file_open") {
      if (want && "file" in e && e.file && !want.has(e.file)) continue;
      const detail =
        e.type === "paste" ? `貼り付け ${e.chars} 文字` : e.type === "run" ? `実行 ${e.mode} ${e.verdict ?? ""} (run_id ${e.run_id})` : e.type === "focus" ? `focus ${e.symbol?.path.join(" > ") ?? "(なし)"}` : `file_open`;
      rows.push({ t: sec(e.t), at: fmtT(e.t), file: "file" in e && e.file ? fileLabel(s, e.file) : null, kind: e.type, summary: detail });
    }
  }
  const pageSize = Math.max(20, Math.min(1000, opts.page_size ?? 200));
  const page = Math.max(1, opts.page ?? 1);
  const fid = fileIdOf(s, events, opts.file)[0];
  return {
    session_id: id,
    t0: opts.t0,
    t1: opts.t1,
    edited_lines: fid ? editedLinesBetween(events, fid, lo, hi) : null,
    page,
    pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    total: rows.length,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    note: "range は Monaco の 1 始まり [startLine, startCol, endLine, endCol]（変更前の文書に対する範囲）。全文は get_code_snapshot_at で。",
  };
}

/** 2 つのテキストの簡易行 diff（先頭・末尾の共通部分を除いた中間だけを出す） */
export function simpleDiff(a: string, b: string): string {
  if (a === b) return "(変更なし)";
  const al = a.split("\n");
  const bl = b.split("\n");
  let i = 0;
  while (i < al.length && i < bl.length && al[i] === bl[i]) i++;
  let j = 0;
  while (j < al.length - i && j < bl.length - i && al[al.length - 1 - j] === bl[bl.length - 1 - j]) j++;
  const out = [`@@ -${i + 1},${al.length - i - j} +${i + 1},${bl.length - i - j} @@`];
  for (const l of al.slice(i, al.length - j)) out.push(`-${l}`);
  for (const l of bl.slice(i, bl.length - j)) out.push(`+${l}`);
  return out.slice(0, 400).join("\n");
}

export async function snapshotAt(store: SessionStore, problemsRoot: string, id: string, tSec: number, file?: string) {
  const s = await requireSession(store, id);
  const events = await store.readEvents(id);
  const problem = await loadProblemFor(problemsRoot, s);
  const t = Math.round(tSec * 1000);
  const out = [];
  for (const fid of fileIdOf(s, events, file)) {
    const cur = await codeAt(store, s, events, problem, fid, t);
    const prevSnap = [...events].reverse().find((e): e is EventOf<"snapshot"> => e.type === "snapshot" && e.file === fid && e.t <= t);
    let diff: string | null = null;
    if (prevSnap) {
      const base = await store.readRel(id, prevSnap.ref).catch(() => null);
      if (base !== null) diff = simpleDiff(base, cur.text);
    }
    out.push({ path: cur.path, file_id: fid, version: cur.version, code: numbered(cur.text), diff_since_snapshot: diff, snapshot_t: prevSnap ? sec(prevSnap.t) : null });
  }
  return { session_id: id, t: tSec, at: fmtT(t), files: out };
}

export async function problemReference(problemsRoot: string, problemId: string) {
  const all = await loadAllProblems(problemsRoot);
  const p = all.find((x) => x.meta.id === problemId);
  if (!p) throw new Error(`問題が見つかりません: ${problemId}`);
  const refs = await loadReferenceSolutions(p, problemsRoot);
  return {
    id: p.meta.id,
    title: p.meta.title,
    category: p.meta.category,
    difficulty: p.meta.difficulty,
    time_limit_min: p.meta.time_limit,
    statement: p.body.statement,
    constraints: p.body.constraints,
    requirements: p.meta.requirements,
    talking_points: p.meta.talking_points,
    rubric_hints: p.meta.rubric_hints,
    interviewer_notes: p.body.interviewer_notes,
    review_notes: p.body.review_notes,
    reference_solutions: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, numbered(v)])),
    note: "requirement_checklist の id は requirements[].id をそのまま使う。参照解と別の手段でも要件を満たしていれば implemented。",
  };
}

export async function framesBetween(store: SessionStore, id: string, opts: { t0: number; t1: number; max_frames?: number; source?: "screen" | "camera" }) {
  const idx = await readFrameIndex(store.dir(id));
  const want = opts.source === "camera" ? "cam" : "screen";
  const all = (idx?.frames ?? []).filter((f) => f.source === want && f.t >= opts.t0 * 1000 && f.t <= opts.t1 * 1000);
  const n = Math.max(1, Math.min(4, opts.max_frames ?? 4));
  const picked = all.length <= n ? all : Array.from({ length: n }, (_, i) => all[Math.floor((i * (all.length - 1)) / (n - 1))]!);
  const out = [];
  for (const f of [...new Set(picked)]) {
    try {
      out.push({ ...f, data: (await fs.readFile(path.join(store.dir(id), f.file))).toString("base64") });
    } catch {
      /* skip */
    }
  }
  return { frames: out, available: all.length };
}

export async function listSessions(store: SessionStore, opts: { limit?: number; problem_id?: string; since?: string }) {
  let ss = await store.list();
  if (opts.problem_id) ss = ss.filter((s) => s.problem.id === opts.problem_id);
  if (opts.since) ss = ss.filter((s) => s.started_at_wall >= opts.since!);
  ss = ss.slice(0, Math.max(1, Math.min(200, opts.limit ?? 20)));
  return ss.map((s) => ({
    session_id: s.session_id,
    problem_id: s.problem.id,
    title: s.problem.title,
    started_at: s.started_at_wall,
    duration_s: s.ended_t !== undefined ? sec(s.ended_t) : null,
    language: s.problem.language,
    status: s.status,
    has_video: s.recorders.length > 0,
    has_transcript: s.stt?.status === "done",
    eval_count: s.evaluations.length,
  }));
}
