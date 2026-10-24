import { z } from "zod";
import { Language } from "./problem.ts";

/**
 * セッションデータ（要件書 01 §5）。
 * data/sessions/<session_id>/
 *   session.json / events.jsonl / media/ / derived/
 * すべての時刻 t は performance.now() 基準のミリ秒（セッション開始 = 0）。
 */

export const SessionStatus = z.enum(["preparing", "recording", "finalizing", "ready", "failed", "recovering"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Recorder = z.object({
  id: z.enum(["cam", "screen"]),
  kind: z.enum(["camera+mic", "mic", "display"]),
  surface: z.string().optional(),
  file: z.string(),
  mime: z.string(),
  t_rec_start: z.number().optional(),
  t_rec_stop: z.number().optional(),
  media_duration_ms: z.number().optional(),
  scale: z.number().default(1),
  chunk_ms: z.number().default(2000),
  chunks_received: z.number().default(0),
  bytes: z.number().default(0),
  gaps: z.array(z.object({ t0: z.number(), t1: z.number() })).default([]),
});
export type Recorder = z.infer<typeof Recorder>;

export const SessionFile = z.object({ file_id: z.string(), path: z.string(), language: Language });

export const Session = z.object({
  schema_version: z.literal("1.0").default("1.0"),
  session_id: z.string(),
  status: SessionStatus,
  problem: z.object({ id: z.string(), title: z.string(), time_limit_sec: z.number(), language: Language, dir: z.string() }),
  started_at_wall: z.string(),
  ended_t: z.number().optional(),
  end_reason: z.enum(["user", "timeout", "crash"]).optional(),
  clock: z.object({ origin: z.literal("performance.now"), unit: z.literal("ms") }).default({ origin: "performance.now", unit: "ms" }),
  recorders: z.array(Recorder).default([]),
  stt: z
    .object({
      engine: z.string(),
      model: z.string(),
      language: z.string(),
      initial_prompt: z.string().optional(),
      elapsed_ms: z.number().optional(),
      status: z.enum(["pending", "running", "done", "failed", "skipped"]).default("pending"),
      error: z.string().optional(),
    })
    .optional(),
  capture_options: z.object({ camera: z.boolean(), screen: z.boolean(), live_stt: z.boolean() }).default({ camera: true, screen: false, live_stt: false }),
  warnings: z.array(z.object({ t: z.number(), code: z.string(), detail: z.string().optional() })).default([]),
  files: z.array(SessionFile).default([]),
  evaluations: z.array(z.string()).default([]).describe("derived/evaluation-*.json の相対パス"),
  /**
   * 終了処理（@lci/evaluator finalizeSession）の記録。E が additive に追加したフィールド。
   * 再実行時に「どのステップに何秒かかったか」「ffmpeg / whisper が使えたか」を UI と CLI で見せるため。
   */
  finalize: z
    .object({
      finished_at_wall: z.string().optional(),
      elapsed_ms: z.record(z.string(), z.number()).default({}),
      tools: z.object({ ffmpeg: z.boolean(), whisper: z.boolean() }).optional(),
      frames: z.number().default(0),
      frame_source: z.enum(["screen", "cam"]).optional(),
    })
    .optional(),
});
export type Session = z.infer<typeof Session>;

// ---- events.jsonl ---------------------------------------------------------

/** Monaco の 1 始まり [startLine, startCol, endLine, endCol] */
export const Range = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type Range = z.infer<typeof Range>;

const base = { t: z.number(), seq: z.number() };

export const Event = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("session_start") }),
  z.object({ ...base, type: z.literal("session_end"), reason: z.enum(["user", "timeout", "crash"]) }),
  z.object({ ...base, type: z.literal("recorder_start"), recorder: z.string() }),
  z.object({ ...base, type: z.literal("recorder_stop"), recorder: z.string() }),
  z.object({ ...base, type: z.literal("file_open"), file: z.string(), language: Language }),
  z.object({ ...base, type: z.literal("snapshot"), file: z.string(), version: z.number(), ref: z.string(), sha1: z.string() }),
  z.object({
    ...base,
    type: z.literal("edit"),
    file: z.string(),
    version: z.number(),
    changes: z.array(z.object({ range: Range, rangeLength: z.number(), text: z.string() })),
    undo: z.boolean().default(false),
    flush: z.boolean().default(false),
  }),
  z.object({ ...base, type: z.literal("cursor"), file: z.string(), pos: z.tuple([z.number(), z.number()]), sel: Range.nullable() }),
  z.object({
    ...base,
    type: z.literal("focus"),
    file: z.string(),
    symbol: z.object({ path: z.array(z.string()), kind: z.string(), range: Range }).nullable(),
    confidence: z.enum(["high", "low"]),
    resolver: z.string(),
  }),
  z.object({ ...base, type: z.literal("paste"), file: z.string(), chars: z.number() }),
  z.object({
    ...base,
    type: z.literal("heartbeat"),
    visibility: z.enum(["visible", "hidden"]),
    cam_chunks: z.number().optional(),
    cam_bytes: z.number().optional(),
    screen_chunks: z.number().optional(),
  }),
  z.object({ ...base, type: z.literal("visibility"), state: z.enum(["visible", "hidden"]) }),
  z.object({
    ...base,
    type: z.literal("run"),
    run_id: z.string(),
    mode: z.enum(["run", "judge"]),
    file: z.string().optional(),
    language: Language,
    verdict: z.string().optional(),
    exit_code: z.number().optional(),
    duration_ms: z.number().optional(),
    ref: z.string().describe("derived/runs/<run_id>.json"),
  }),
  z.object({ ...base, type: z.literal("followup_shown"), text: z.string() }),
  z.object({ ...base, type: z.literal("marker"), label: z.string() }),
  /**
   * W1 追加（追加のみ）: 録画トラックの ended、チャンク送信失敗など
   * 「セッションは止めないが後で気づきたい」事象。code は track_ended / upload_failed / … の自由文字列。
   */
  z.object({ ...base, type: z.literal("warning"), code: z.string(), detail: z.string().optional() }),
]);
export type Event = z.infer<typeof Event>;
export type EventOf<T extends Event["type"]> = Extract<Event, { type: T }>;

// ---- derived/transcript.json ---------------------------------------------

export const TranscriptWord = z.object({ w: z.string(), start_ms: z.number(), end_ms: z.number() });

export const TranscriptSegment = z.object({
  id: z.number(),
  start_ms: z.number(),
  end_ms: z.number(),
  t_start: z.number(),
  t_end: z.number(),
  text: z.string(),
  avg_logprob: z.number().optional(),
  no_speech_prob: z.number().optional(),
  is_filler: z.boolean().default(false),
  silence_ms: z.number().optional(),
  words: z.array(TranscriptWord).default([]),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

export const Transcript = z.object({
  schema_version: z.literal("1.0").default("1.0"),
  recorder: z.string(),
  engine: z.string(),
  segments: z.array(TranscriptSegment),
});
export type Transcript = z.infer<typeof Transcript>;

// ---- derived/runs/<run_id>.json ------------------------------------------

export const Verdict = z.enum(["AC", "WA", "RE", "TLE", "MLE", "OLE", "CE", "IE", "PASS", "FAIL"]);
export type Verdict = z.infer<typeof Verdict>;

export const Diagnostic = z.object({
  file: z.string().optional(),
  line: z.number().optional(),
  col: z.number().optional(),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
});
/** 追加 export（R 担当、2026-10-24）: runner が型として使う */
export type Diagnostic = z.infer<typeof Diagnostic>;

export const CaseResult = z.object({
  name: z.string(),
  visibility: z.enum(["sample", "hidden"]).default("hidden"),
  verdict: Verdict,
  time_ms: z.number().optional(),
  memory_kb: z.number().optional(),
  stdout: z.string().optional(),
  expected: z.string().optional(),
  stderr: z.string().optional(),
  message: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type CaseResult = z.infer<typeof CaseResult>;

export const RunResult = z.object({
  run_id: z.string(),
  mode: z.enum(["run", "judge"]),
  language: Language,
  started_at_wall: z.string(),
  t: z.number(),
  verdict: Verdict,
  compile: z.object({ ok: z.boolean(), stdout: z.string(), stderr: z.string(), diagnostics: z.array(Diagnostic), time_ms: z.number() }).optional(),
  exit_code: z.number().optional(),
  duration_ms: z.number(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  cases: z.array(CaseResult).default([]),
  /** web 判定のみ: リクエスト計測など */
  behavior: z
    .object({
      requests: z.array(z.object({ t: z.number(), url: z.string(), status: z.enum(["completed", "aborted", "failed", "blocked"]) })),
      techniques: z.array(z.string()),
    })
    .optional(),
  infra: z.object({ backend: z.enum(["docker", "iframe", "none"]), image: z.string().optional() }),
});
export type RunResult = z.infer<typeof RunResult>;
