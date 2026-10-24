import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SessionStore, type Event, type Evaluation, type Session, type Transcript } from "@lci/core";
import { mapMediaToSession, whisperJsonToSegments, buildInitialPrompt, isFiller, type WhisperJson } from "./whisper.ts";
import { finalizeSession } from "./finalize.ts";
import { buildEvaluationContext, formatTimeline, mergeSegments } from "./context.ts";
import { verifyEvaluation, quoteOverlap } from "./verify.ts";
import { evaluateSession, NoApiKeyError } from "./evaluate.ts";
import { draftJsonSchema, draftToEvaluation, normalizeDraftTimes, EvaluationDraft, type EvaluationDraft as Draft } from "./schema.ts";
import { PROMPT_VERSION, SYSTEM_PROMPT, promptHash, buildMcpEvaluatePrompt } from "./prompt.ts";
import { pickKeyframeTimes } from "./frames.ts";

const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const PROBLEM_DIR = "FE/fe-0001-search-form-cache";
const FIXTURE = path.join(import.meta.dirname, "fixtures", "whisper-sample.json");

function hasBin(bin: string): boolean {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const HAS_FFMPEG = hasBin("ffmpeg") && hasBin("ffprobe");

async function tmpStore(): Promise<SessionStore> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-eval-"));
  return new SessionStore(root);
}

const ENDED = 60_000;

function baseSession(id: string, recorders: Session["recorders"] = []): Session {
  return {
    schema_version: "1.0",
    session_id: id,
    status: "finalizing",
    problem: { id: "fe-0001", title: "検索フォームとサーバーに優しいキャッシュ", time_limit_sec: 1200, language: "html", dir: PROBLEM_DIR },
    started_at_wall: "2026-10-24T10:00:00.000+09:00",
    ended_t: ENDED,
    end_reason: "user",
    clock: { origin: "performance.now", unit: "ms" },
    recorders,
    capture_options: { camera: true, screen: false, live_stt: false },
    warnings: [],
    files: [{ file_id: "f1", path: "index.html", language: "html" }],
    evaluations: [],
  };
}

const edit = (t: number, seq: number, line: number, text: string): Event => ({
  t,
  seq,
  type: "edit",
  file: "f1",
  version: seq,
  changes: [{ range: [line, 1, line, 1], rangeLength: 0, text }],
  undo: false,
  flush: false,
});

async function seedSession(store: SessionStore, id: string, opts: { transcript?: boolean; recorders?: Session["recorders"] } = {}) {
  await store.create(baseSession(id, opts.recorders));
  const snapRef = await store.writeSnapshot(id, "f1", 500, "<html>\n<body>\n</body>\n</html>\n");
  const events: Event[] = [
    { t: 0, seq: 1, type: "session_start" },
    { t: 500, seq: 2, type: "snapshot", file: "f1", version: 1, ref: snapRef, sha1: "" },
    edit(5_000, 3, 3, "<input id=q>\n"),
    edit(6_000, 4, 4, "<button>検索</button>\n"),
    edit(20_000, 5, 5, "<script>const cache = new Map();</script>\n"),
    { t: 25_000, seq: 6, type: "run", run_id: "r1", mode: "run", language: "html", verdict: "PASS", ref: "derived/runs/r1.json" },
    edit(40_000, 7, 6, "<div id=out></div>\n"),
    { t: ENDED, seq: 8, type: "session_end", reason: "user" },
  ];
  await store.appendEvents(id, events);
  await store.closeEvents(id);
  if (opts.transcript) {
    const tr: Transcript = {
      schema_version: "1.0",
      recorder: "cam",
      engine: "test",
      segments: [
        { id: 1, start_ms: 0, end_ms: 3000, t_start: 1000, t_end: 4000, text: "まず空のクエリはリクエストを送らないようにします", is_filler: false, words: [] },
        { id: 2, start_ms: 17000, end_ms: 21000, t_start: 18000, t_end: 22000, text: "同じクエリはキャッシュのMapから返してTTLで古いのを捨てます", is_filler: false, words: [] },
      ],
    };
    await store.saveTranscript(id, tr);
  }
}

// ---- whisper / t mapping -----------------------------------------------------

test("t mapping: t = t_rec_start + media_ms * scale", () => {
  assert.equal(mapMediaToSession(10_000, { t_rec_start: 1532, scale: 1 }), 11_532);
  assert.equal(mapMediaToSession(1_000_000, { t_rec_start: 1000, scale: 1.001 }), 1_002_000);
  assert.equal(mapMediaToSession(500, undefined), 500);
});

test("whisper.cpp JSON → segments: mapping, silence gaps, fillers, hallucination drop", async () => {
  const json = JSON.parse(await fs.readFile(FIXTURE, "utf8")) as WhisperJson;
  const segs = whisperJsonToSegments(json, { t_rec_start: 1000, scale: 1.01 });
  const speech = segs.filter((s) => s.text);
  assert.equal(speech.length, 3, "幻覚フレーズと空白セグメントは落ちる");
  assert.equal(speech[0]!.text, "まず空のクエリはリクエストを送らないようにします");
  assert.equal(speech[0]!.t_start, 1000);
  assert.equal(speech[0]!.t_end, 1000 + Math.round(3000 * 1.01));
  assert.equal(speech[0]!.words.length, 2, "特殊トークン [_BEG_] は除外");
  assert.ok(speech[0]!.avg_logprob !== undefined && speech[0]!.avg_logprob < 0);
  assert.equal(speech[1]!.is_filler, true);
  // 4000ms → 10000ms の 6 秒の空き（≥ 3s）に無音セグメントが入る
  const sil = segs.find((s) => !s.text && s.start_ms === 4000);
  assert.ok(sil, "無音セグメント");
  assert.equal(sil!.silence_ms, 6000);
  assert.equal(sil!.t_start, 1000 + Math.round(4000 * 1.01));
  // id は連番
  assert.deepEqual(segs.map((s) => s.id), segs.map((_, i) => i + 1));
});

test("filler regex and initial prompt", async () => {
  assert.ok(isFiller("えーっと、"));
  assert.ok(isFiller("あのー"));
  assert.ok(!isFiller("あのキャッシュは"));
  const { loadProblemDir } = await import("@lci/core");
  const p = await loadProblemDir(PROBLEMS_ROOT, PROBLEM_DIR);
  const prompt = buildInitialPrompt(p.meta);
  assert.ok(prompt.includes("AbortController"));
  assert.ok(prompt.includes("TTL"));
  assert.ok(prompt.length <= 260);
});

// ---- finalize ------------------------------------------------------------------

test("finalize without ffmpeg/whisper: ready, stt skipped, metrics saved, idempotent", async () => {
  const store = await tmpStore();
  const id = "s_noffmpeg";
  await seedSession(store, id, {
    recorders: [{ id: "cam", kind: "camera+mic", file: "media/cam.webm", mime: "video/webm", t_rec_start: 1000, t_rec_stop: 59_000, scale: 1, chunk_ms: 2000, chunks_received: 1, bytes: 4, gaps: [] }],
  });
  await fs.writeFile(path.join(store.dir(id), "media", "cam.webm.part"), Buffer.from("junk"));
  const opts = { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", whisperBin: "/nonexistent/whisper-cli", problemsRoot: PROBLEMS_ROOT };
  const s1 = await finalizeSession(store, id, opts);
  assert.equal(s1.status, "ready");
  assert.equal(s1.stt?.status, "skipped");
  assert.match(s1.stt?.error ?? "", /ffmpeg/);
  assert.ok(s1.warnings.some((w) => w.code === "ffmpeg_missing"));
  assert.equal(s1.finalize?.tools?.ffmpeg, false);
  // .part は .webm に退避されている（後で ffmpeg を入れて再実行すれば再 mux）
  await fs.access(path.join(store.dir(id), "media", "cam.webm"));
  await assert.rejects(fs.access(path.join(store.dir(id), "media", "cam.webm.part")));
  const m = await store.getMetrics<{ edit_total_events: number; run_events: unknown[] }>(id);
  assert.equal(m?.edit_total_events, 4);
  assert.equal(m?.run_events.length, 1);

  const s2 = await finalizeSession(store, id, opts);
  assert.equal(s2.status, "ready");
  assert.equal(s2.warnings.filter((w) => w.code === "ffmpeg_missing").length, 1, "警告は重複しない");
  assert.equal(await store.getTranscript(id), null);
});

test("finalize: concurrent calls share one run", async () => {
  const store = await tmpStore();
  const id = "s_concurrent";
  await seedSession(store, id);
  const opts = { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", skipTranscribe: true, problemsRoot: PROBLEMS_ROOT };
  const a = finalizeSession(store, id, opts);
  const b = finalizeSession(store, id, opts);
  assert.equal(a, b);
  assert.equal((await a).status, "ready");
});

test("finalize keeps an existing transcript and computes metrics from it", async () => {
  const store = await tmpStore();
  const id = "s_tr";
  await seedSession(store, id, { transcript: true });
  const s = await finalizeSession(store, id, { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", problemsRoot: PROBLEMS_ROOT });
  assert.equal(s.status, "ready");
  assert.equal(s.stt?.status, "done");
  const m = await store.getMetrics<{ talking_point_hits: { id: string; t: number | null }[] }>(id);
  assert.equal(m?.talking_point_hits.find((h) => h.id === "tp1")?.t, 1000);
  assert.equal(m?.talking_point_hits.find((h) => h.id === "tp2")?.t, 18000);
});

test("finalize with real ffmpeg: remux, scale, wav, keyframes; idempotent", { skip: !HAS_FFMPEG && "ffmpeg not installed" }, async () => {
  const store = await tmpStore();
  const id = "s_ffmpeg";
  const recBase = { mime: "video/webm", chunk_ms: 2000, chunks_received: 1, bytes: 0, gaps: [] as { t0: number; t1: number }[], scale: 1 };
  await seedSession(store, id, {
    recorders: [
      { ...recBase, id: "cam", kind: "camera+mic", file: "media/cam.webm", t_rec_start: 1000, t_rec_stop: 7_030 },
      { ...recBase, id: "screen", kind: "display", file: "media/screen.webm", t_rec_start: 1000, t_rec_stop: 7_030 },
    ],
  });
  // ended_t を短い動画に合わせる
  await store.update(id, (s) => {
    s.ended_t = 7_000;
  });
  for (const rec of ["cam", "screen"]) {
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc=duration=6:size=320x240:rate=5",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libvpx", "-b:v", "200k", "-c:a", "libopus", "-ac", "1", "-f", "webm",
      path.join(store.dir(id), "media", `${rec}.webm.part`),
    ]);
  }
  const opts = { whisperBin: "/nonexistent/whisper-cli", problemsRoot: PROBLEMS_ROOT };
  const s = await finalizeSession(store, id, opts);
  assert.equal(s.status, "ready");
  const cam = s.recorders.find((r) => r.id === "cam")!;
  assert.ok(cam.media_duration_ms && Math.abs(cam.media_duration_ms - 6000) < 200, `duration ${cam.media_duration_ms}`);
  assert.ok(cam.scale > 0.98 && cam.scale < 1.02);
  assert.ok(Math.abs(cam.scale - 6030 / cam.media_duration_ms!) < 1e-4);
  await fs.access(path.join(store.dir(id), "derived", "audio16k.wav"));
  assert.equal(s.stt?.status, "skipped");
  assert.match(s.stt?.error ?? "", /whisper-cli/);
  assert.ok((s.finalize?.frames ?? 0) >= 1, "screen からフレームが出る");
  assert.equal(s.finalize?.frame_source, "screen");
  const frames = await fs.readdir(path.join(store.dir(id), "derived", "frames"));
  assert.ok(frames.some((f) => f.endsWith(".jpg")));
  // 2 回目: 何も壊さずに ready
  const s2 = await finalizeSession(store, id, opts);
  assert.equal(s2.status, "ready");
  assert.equal(s2.recorders.find((r) => r.id === "cam")!.media_duration_ms, cam.media_duration_ms);
});

test("keyframe picking: event-driven, capped, deduped", () => {
  const events: Event[] = [];
  for (let i = 0; i < 30; i++) events.push(edit(10_000 + i * 500, i + 1, 1, "x"));
  for (let i = 0; i < 30; i++) events.push({ t: 100_000 + i * 20_000, seq: 100 + i, type: "run", run_id: `r${i}`, mode: "run", language: "html", ref: "" });
  const times = pickKeyframeTimes({ events, metrics: null, ended_t: 800_000, cap: 16 });
  assert.ok(times.length <= 16);
  assert.ok(times.some((t) => t.reason === "終了時"));
  for (let i = 1; i < times.length; i++) assert.ok(times[i]!.t - times[i - 1]!.t >= 5000);
});

// ---- context -------------------------------------------------------------------

test("context builder: mm:ss timeline rows, snapshots, problem, metrics", async () => {
  const store = await tmpStore();
  const id = "s_ctx";
  await seedSession(store, id, { transcript: true });
  await finalizeSession(store, id, { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", problemsRoot: PROBLEMS_ROOT });
  const ctx = await buildEvaluationContext({ store, problemsRoot: PROBLEMS_ROOT, sessionId: id, includeFrames: true });
  assert.match(ctx.text, /\[00:01–00:04\] まず空のクエリ/);
  assert.match(ctx.text, /\[00:18–00:22\] 同じクエリ/);
  assert.match(ctx.text, /無発話/);
  assert.match(ctx.text, /▶ 実行 run verdict=PASS/);
  assert.match(ctx.text, /### index\.html @ 00:15 \(25%/);
  assert.match(ctx.text, /### index\.html @ 01:00 \(100%/);
  assert.ok(ctx.text.includes("const cache = new Map();"));
  assert.ok(ctx.text.includes("no_empty_query"), "要件 id");
  assert.ok(ctx.text.includes("参照解"), "参照解");
  assert.ok(ctx.text.includes("silence_gt15s"), "metrics JSON");
  assert.equal(ctx.input_digest.transcript_segments, 2);
  assert.equal(ctx.input_digest.edit_events, 4);
  assert.equal(ctx.frames.length, 0);
  assert.ok(ctx.estimated_tokens < 60_000);
  // 決定的
  const ctx2 = await buildEvaluationContext({ store, problemsRoot: PROBLEMS_ROOT, sessionId: id });
  assert.equal(ctx.text, ctx2.text);
});

test("context: transcript rows > 400 are merged", () => {
  const segs = Array.from({ length: 1000 }, (_, i) => ({ id: i, start_ms: i * 1000, end_ms: i * 1000 + 900, t_start: i * 1000, t_end: i * 1000 + 900, text: `発話${i}`, is_filler: false, words: [] }));
  const merged = mergeSegments(segs, 400);
  assert.ok(merged.length <= 400);
  assert.equal(merged[0]!.t_start, 0);
  assert.ok(merged[0]!.text.startsWith("発話0 発話1"));
  const tl = formatTimeline({ segments: merged, events: [], ended_t: 1_000_000, label: (f) => f });
  assert.match(tl, /^【タイムライン】/);
});

// ---- schema / verify -----------------------------------------------------------

function sampleDraft(): Draft {
  const axis = (score: number) => ({ score, confidence: 0.7, rationale: "r", evidence: [{ type: "metric" as const, name: "run_events" }] });
  return {
    scores: {
      R1_requirements: { ...axis(4), evidence: [{ type: "transcript", t0: 1, t1: 4, quote: "空のクエリはリクエストを送らない" }] },
      R2_plan: axis(3),
      R3_tradeoffs: axis(3),
      R4_correctness: axis(3),
      R5_testing: axis(2),
      R6_time: axis(3),
      R7_sync: axis(3),
      R8_attitude: { ...axis(3), evidence: [{ type: "transcript", t0: 30, t1: 35, quote: "サーバーのことは全く考えていません" }] },
    },
    requirement_checklist: [
      { id: "no_empty_query", label: "空クエリ", status: "mentioned_only", mentioned_at: 1 },
      { id: "layout", label: "レイアウト", status: "implemented", code_ref: { file: "index.html", lines: [3, 5], at: 60 } },
    ],
    feedback: [
      {
        id: "f2", t: 30, axis: "R8_attitude", severity: "major", kind: "gap", title: "捏造", detail: "d",
        evidence: [{ type: "transcript", t0: 30, t1: 35, quote: "サーバーのことは全く考えていません" }], speculative: false,
      },
      {
        id: "f1", t: 1, t_end: 4, axis: "R1_requirements", severity: "positive", kind: "strength", title: "実在", detail: "d",
        evidence: [{ type: "transcript", t0: 1, t1: 4, quote: "まず空のクエリは、リクエストを送らない" }, { type: "edit", t: 5, file: "index.html", lines: [3, 3] }],
        code_ref: { file: "index.html", lines: [4, 3], at: 15 }, speculative: false,
      },
      { id: "f3", t: 40, axis: "R7_sync", severity: "minor", kind: "silence", title: "証拠なし", detail: "d", evidence: [], speculative: false },
    ],
    model_answer_comparison: { covered: ["layout"], missing: ["no_empty_query"], beyond_model: [], notes: "" },
    next_practice: [{ axis: "R5_testing", action: "区切りで実行", based_on: ["metrics.run_events"] }],
    summary: "s",
    uncertainties: [],
    self_check: "ok",
  };
}

const META = {
  session_id: "s", problem_id: "fe-0001", model: "m", route: "in_app_api" as const, rubric_version: "2026.10-a",
  input_digest: { transcript_segments: 2, edit_events: 4, frames: 0, metrics_version: "1" }, duration_ms: 60_000,
};

test("draft schema: enums kept, no tuples, objects closed", () => {
  const s = JSON.stringify(draftJsonSchema());
  assert.ok(!s.includes("prefixItems"));
  assert.ok(s.includes('"enum":["R1_requirements"'));
  assert.ok(s.includes('"const":"transcript"'));
  assert.ok(!s.includes('"minimum"'));
  assert.ok(!s.includes("$schema"));
  EvaluationDraft.parse(sampleDraft());
});

test("draftToEvaluation: seconds → session ms, tuples, overall recomputed, sorted", () => {
  const ev = draftToEvaluation(sampleDraft(), META);
  assert.equal(ev.feedback[0]!.id, "f1");
  assert.equal(ev.feedback[0]!.t, 1000);
  assert.equal(ev.feedback[0]!.t_end, 4000);
  assert.deepEqual(ev.feedback[0]!.code_ref, { file: "index.html", lines: [3, 4], at: 15_000 });
  const e = ev.feedback[0]!.evidence[0]!;
  assert.ok(e.type === "transcript" && e.t0 === 1000 && e.t1 === 4000);
  assert.equal(ev.requirement_checklist[0]!.mentioned_at, 1000);
  assert.equal(ev.requirement_checklist[1]!.code_ref?.at, 60_000);
  assert.equal(ev.scores.overall, 3.1);
  // ミリ秒で返ってきた値はそのまま
  const d = sampleDraft();
  d.feedback[0]!.t = 30_000;
  assert.equal(draftToEvaluation(d, META).feedback.find((f) => f.id === "f2")!.t, 30_000);
  // mm:ss 文字列の救済
  const n = normalizeDraftTimes({ feedback: [{ t: "01:50", evidence: [{ t0: "2:05", t1: 130 }] }] }) as { feedback: { t: number; evidence: { t0: number }[] }[] };
  assert.equal(n.feedback[0]!.t, 110);
  assert.equal(n.feedback[0]!.evidence[0]!.t0, 125);
});

test("evidence verification marks a bogus quote speculative", () => {
  const segs = [
    { id: 1, start_ms: 0, end_ms: 3000, t_start: 1000, t_end: 4000, text: "まず空のクエリはリクエストを送らないようにします", is_filler: false, words: [] },
  ];
  assert.equal(quoteOverlap("まず空のクエリは、リクエストを送らない", segs), 1);
  assert.ok(quoteOverlap("まず空クエリはリクエストを送らないです", segs) >= 0.7);
  assert.ok(quoteOverlap("サーバーのことは全く考えていません", segs) < 0.7);
  const ev: Evaluation = draftToEvaluation(sampleDraft(), META);
  const r = verifyEvaluation({ ...ev, scores: { ...ev.scores, overall: 5 } }, segs);
  const byId = Object.fromEntries(r.evaluation.feedback.map((f) => [f.id, f]));
  assert.equal(byId.f1!.speculative, false);
  assert.equal(byId.f2!.speculative, true);
  assert.equal(byId.f3!.speculative, true, "証拠なしも推測");
  assert.deepEqual(r.demoted.sort(), ["f2", "f3"]);
  assert.ok(r.evaluation.scores.R8_attitude.confidence <= 0.5);
  assert.equal(r.evaluation.scores.overall, 3.1, "overall は再計算");
  assert.ok(r.evaluation.uncertainties.some((u) => u.includes("推測")));
});

// ---- prompt / evaluate -----------------------------------------------------------

test("prompt: rubric, weights, anti-flattery, hash", () => {
  assert.ok(SYSTEM_PROMPT.includes("R1_requirements"));
  assert.ok(SYSTEM_PROMPT.includes("重み 20%"));
  assert.ok(SYSTEM_PROMPT.includes("positive は最大 2 件"));
  assert.ok(SYSTEM_PROMPT.includes("アボートコントローラー"));
  assert.ok(SYSTEM_PROMPT.includes("フィラー"));
  assert.match(promptHash(), /^sha256:[0-9a-f]{64}$/);
  assert.equal(promptHash(), promptHash());
  assert.ok(PROMPT_VERSION);
  const mcp = buildMcpEvaluatePrompt("abc");
  assert.ok(mcp.startsWith(SYSTEM_PROMPT));
  assert.ok(mcp.includes("save_evaluation"));
});

test("evaluate: dry-run returns prompt + context without API; NoApiKeyError without key", async () => {
  const store = await tmpStore();
  const id = "s_eval";
  await seedSession(store, id, { transcript: true });
  await finalizeSession(store, id, { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", problemsRoot: PROBLEMS_ROOT });
  const r = await evaluateSession({ store, problemsRoot: PROBLEMS_ROOT, sessionId: id, dryRun: true });
  assert.equal(r.dry_run, true);
  assert.equal(r.model, "claude-opus-5-5");
  assert.equal(r.system[0]!.text, SYSTEM_PROMPT);
  assert.deepEqual(r.system[0]!.cache_control, { type: "ephemeral" });
  assert.match(r.user_text, /\[00:01–00:04\]/);
  assert.equal(r.prompt_hash, promptHash());

  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(evaluateSession({ store, problemsRoot: PROBLEMS_ROOT, sessionId: id }), NoApiKeyError);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("evaluate with a stub client: parses structured output, verifies, saves", async () => {
  const store = await tmpStore();
  const id = "s_stub";
  await seedSession(store, id, { transcript: true });
  await finalizeSession(store, id, { ffmpegBin: "/nonexistent/ffmpeg", ffprobeBin: "/nonexistent/ffprobe", problemsRoot: PROBLEMS_ROOT });
  let calls = 0;
  let lastParams: Record<string, unknown> = {};
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls++;
          lastParams = params;
          const text = calls === 1 ? "{not json" : JSON.stringify(sampleDraft());
          return {
            finalMessage: async () => ({
              model: "claude-opus-5-5",
              stop_reason: "end_turn",
              content: [{ type: "text", text }],
              usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 80 },
            }),
          };
        },
      },
    },
  } as unknown as import("@anthropic-ai/sdk").default;
  const ev = await evaluateSession({ store, problemsRoot: PROBLEMS_ROOT, sessionId: id, client });
  assert.equal(calls, 2, "パース失敗で 1 回リトライ");
  assert.equal(ev.route, "in_app_api");
  assert.equal(ev.rubric_version, "2026.10-a");
  assert.equal(ev.prompt_hash, promptHash());
  assert.equal(ev.usage?.input_tokens, 100);
  assert.equal(ev.feedback.find((f) => f.id === "f2")!.speculative, true);
  assert.equal((lastParams.output_config as { effort: string }).effort, "high");
  assert.deepEqual(lastParams.thinking, { type: "adaptive" });
  assert.equal(lastParams.fallbacks, "default");
  const list = await store.getEvaluations(id);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.feedback[0]!.t, 1000);
});
