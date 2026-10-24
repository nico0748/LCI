import { promises as fs } from "node:fs";
import path from "node:path";
import {
  computeMetrics,
  loadProblemDir,
  type Metrics,
  type ProblemMeta,
  type Recorder,
  type Session,
  type SessionStore,
  type Transcript,
} from "@lci/core";
import { exists, extractWav16k, probeDurationMs, remux, which } from "./ffmpeg.ts";
import { buildInitialPrompt, runWhisper, whisperJsonToSegments } from "./whisper.ts";
import { FRAME_INDEX_REL, extractKeyframes, pickKeyframeTimes, readFrameIndex, type FrameIndex } from "./frames.ts";

/**
 * セッション終了処理（要件書 00 §4 ステップ 3、01 FR-C-08/09/20/42/51、03 FR-E-02/12）。
 *
 * 冪等なステートマシンとして書く: 各ステップは「成果物が既にあるか」で実行要否を決めるので、
 * 2 回呼んでも、途中で落ちて再実行しても、ffmpeg / whisper が無くても最後まで走って status を確定させる。
 *
 *   1. media/<id>.webm.part → ffmpeg 再 mux → media/<id>.webm、ffprobe で実長を測り scale を算出
 *   2. cam から derived/audio16k.wav を抽出
 *   3. whisper.cpp で derived/transcript.json（無ければ stt.status = skipped と理由）
 *   4. core.computeMetrics → derived/metrics.json（常に再計算。安い）
 *   5. 画面録画から出来事駆動のキーフレーム → derived/frames/
 *   6. status = ready（致命的エラーのみ failed）
 */

export interface FinalizeOptions {
  whisperBin?: string;
  whisperModel?: string;
  skipTranscribe?: boolean;
  /** Web カメラ映像からのフレーム抽出を許可（既定 false。03 §6.2） */
  allowCamFrames?: boolean;
  ffmpegBin?: string;
  ffprobeBin?: string;
  /** 問題ディレクトリ（talking_points と initial_prompt に使う）。無ければ環境変数 LCI_PROBLEMS_ROOT */
  problemsRoot?: string;
  maxFrames?: number;
  threads?: number;
  /** 既存の派生物（transcript / frames）があっても作り直す */
  force?: boolean;
  log?: (msg: string) => void;
}

const SCALE_MIN = 0.98;
const SCALE_MAX = 1.02;

/** Next.js dev はモジュールを再評価するので in-flight 表は globalThis に置く */
const g = globalThis as unknown as { __lciFinalizing?: Map<string, Promise<Session>> };
function inflight(): Map<string, Promise<Session>> {
  g.__lciFinalizing ??= new Map();
  return g.__lciFinalizing;
}

export function isFinalizing(sessionId: string): boolean {
  return inflight().has(sessionId);
}

/** 同じセッションに対する同時呼び出しは 1 本にまとめる（Route Handler と CLI が重なっても二重 ffmpeg にしない） */
export function finalizeSession(store: SessionStore, sessionId: string, opts: FinalizeOptions = {}): Promise<Session> {
  const m = inflight();
  const existing = m.get(sessionId);
  if (existing) return existing;
  const p = doFinalize(store, sessionId, opts).finally(() => m.delete(sessionId));
  m.set(sessionId, p);
  return p;
}

async function doFinalize(store: SessionStore, sessionId: string, opts: FinalizeOptions): Promise<Session> {
  const log = opts.log ?? (() => {});
  const s = await store.get(sessionId);
  if (!s) throw new Error(`session not found: ${sessionId}`);
  const dir = store.dir(sessionId);
  const elapsed: Record<string, number> = { ...(s.finalize?.elapsed_ms ?? {}) };
  const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      elapsed[name] = Date.now() - t0;
    }
  };
  const events = await store.readEvents(sessionId);
  if (s.ended_t === undefined) {
    // end を経由せず finalize された（クラッシュ復旧）。最後のイベントか録画停止時刻で代用する
    const lastT = events.length ? events[events.length - 1]!.t : 0;
    const recStop = Math.max(0, ...s.recorders.map((r) => r.t_rec_stop ?? 0));
    s.ended_t = Math.max(lastT, recStop);
    s.end_reason ??= "crash";
  }
  const ended_t = s.ended_t;
  const warn = (code: string, detail: string, t = ended_t) => {
    if (!s.warnings.some((w) => w.code === code && w.detail === detail)) s.warnings.push({ t, code, detail });
    log(`[finalize] warn ${code}: ${detail}`);
  };

  s.status = "finalizing";
  await store.save(s);

  const ffmpeg = await which(opts.ffmpegBin ?? process.env.LCI_FFMPEG_BIN ?? "ffmpeg");
  const ffprobe = await which(opts.ffprobeBin ?? process.env.LCI_FFPROBE_BIN ?? "ffprobe");
  if (!ffmpeg) warn("ffmpeg_missing", "ffmpeg が見つかりません。再 mux・音声抽出・フレーム抽出をスキップします（brew install ffmpeg）");

  // 問題メタ（talking_points と initial_prompt 用）。読めなくても処理は続ける
  const problemsRoot = opts.problemsRoot ?? process.env.LCI_PROBLEMS_ROOT;
  let meta: ProblemMeta | null = null;
  if (problemsRoot && s.problem.dir) {
    try {
      meta = (await loadProblemDir(problemsRoot, s.problem.dir)).meta;
    } catch (e) {
      warn("problem_unreadable", `問題 ${s.problem.dir} を読めません: ${(e as Error).message}`);
    }
  }

  const whisperBin = await which(opts.whisperBin ?? process.env.LCI_WHISPER_BIN ?? "whisper-cli");
  const whisperModel = opts.whisperModel ?? process.env.LCI_WHISPER_MODEL ?? "";

  try {
    // ---- 1. 再 mux と scale ------------------------------------------------
    await timed("remux", async () => {
      for (const rec of s.recorders) await finalizeRecorder(rec, dir, { ffmpeg, ffprobe, warn, log });
    });

    // ---- 2. 16kHz WAV -------------------------------------------------------
    const audioRec = s.recorders.find((r) => r.id === "cam") ?? s.recorders.find((r) => r.kind === "mic" || r.kind === "camera+mic");
    const wav = path.join(dir, "derived", "audio16k.wav");
    await timed("wav", async () => {
      if (!audioRec) return;
      const src = path.join(dir, audioRec.file);
      if (!(await exists(src))) return;
      if ((await exists(wav)) && !opts.force) return;
      if (!ffmpeg) return;
      await fs.mkdir(path.dirname(wav), { recursive: true });
      const r = await extractWav16k(ffmpeg, src, wav);
      if (r.code !== 0) warn("wav_failed", `音声抽出に失敗: ${r.stderr.slice(-300)}`);
    });

    // ---- 3. 文字起こし -------------------------------------------------------
    let transcript: Transcript | null = await store.getTranscript(sessionId);
    await timed("stt", async () => {
      if (transcript && !opts.force) {
        s.stt ??= { engine: transcript.engine, model: "", language: "ja", status: "done" };
        if (s.stt.status !== "done") s.stt.status = "done";
        return;
      }
      const initial_prompt = meta ? buildInitialPrompt(meta) : s.problem.title;
      const base = { engine: "whisper.cpp", model: whisperModel ? path.basename(whisperModel) : "", language: "ja", initial_prompt };
      if (opts.skipTranscribe) {
        s.stt = { ...base, status: "skipped", error: "skipTranscribe が指定されました" };
        return;
      }
      if (!(await exists(wav))) {
        s.stt = { ...base, status: "skipped", error: ffmpeg ? "録音（cam）が無いため音声を抽出できませんでした" : "ffmpeg が無いため音声（derived/audio16k.wav）を抽出できませんでした" };
        return;
      }
      if (!whisperBin) {
        s.stt = { ...base, status: "skipped", error: "whisper-cli が見つかりません。`brew install whisper-cpp` を実行するか LCI_WHISPER_BIN を設定してください" };
        return;
      }
      if (!whisperModel || !(await exists(whisperModel))) {
        s.stt = { ...base, status: "skipped", error: "LCI_WHISPER_MODEL（ggml-large-v3-turbo.bin のパス）が未設定か存在しません（docs/setup-mac.md 参照）" };
        return;
      }
      s.stt = { ...base, status: "running" };
      await store.save(s);
      try {
        const outPrefix = path.join(dir, "derived", "whisper");
        const r = await runWhisper({ bin: whisperBin, model: whisperModel, wav, outPrefix, initialPrompt: initial_prompt, threads: opts.threads });
        const segments = whisperJsonToSegments(r.json, audioRec);
        transcript = {
          schema_version: "1.0",
          recorder: audioRec?.id ?? "cam",
          engine: `whisper.cpp ${r.json.model?.type ?? ""} ${path.basename(whisperModel)}`.trim(),
          segments,
        };
        await store.saveTranscript(sessionId, transcript);
        s.stt = { ...base, status: "done", elapsed_ms: r.elapsed_ms };
        log(`[finalize] stt done: ${segments.length} segments in ${r.elapsed_ms}ms`);
      } catch (e) {
        s.stt = { ...base, status: "failed", error: (e as Error).message.slice(0, 1000) };
        warn("stt_failed", (e as Error).message.slice(0, 300));
      }
    });

    // ---- 4. 指標 -------------------------------------------------------------
    let metrics: Metrics | null = null;
    await timed("metrics", async () => {
      const m: ProblemMeta = meta ?? ({ talking_points: [] } as unknown as ProblemMeta);
      metrics = computeMetrics({ events, segments: transcript?.segments ?? [], meta: m, ended_t });
      await store.saveMetrics(sessionId, metrics);
    });

    // ---- 5. キーフレーム -----------------------------------------------------
    let frameIndex: FrameIndex | null = await readFrameIndex(dir);
    await timed("frames", async () => {
      if (!ffmpeg) return;
      if (frameIndex && frameIndex.frames.length > 0 && !opts.force) return;
      const screen = s.recorders.find((r) => r.id === "screen");
      const cam = s.recorders.find((r) => r.id === "cam");
      let rec: Recorder | undefined;
      if (screen && (await exists(path.join(dir, screen.file)))) rec = screen;
      else if (opts.allowCamFrames && cam && (await exists(path.join(dir, cam.file)))) rec = cam;
      if (!rec) {
        frameIndex = null;
        return;
      }
      const times = pickKeyframeTimes({ events, metrics, ended_t, cap: opts.maxFrames ?? 16 });
      frameIndex = await extractKeyframes({ ffmpeg, sessionDir: dir, recorder: rec, times });
      log(`[finalize] frames: ${frameIndex.frames.length} from ${rec.id}`);
    });

    s.status = "ready";
    s.finalize = {
      finished_at_wall: new Date().toISOString(),
      elapsed_ms: elapsed,
      tools: { ffmpeg: !!ffmpeg, whisper: !!whisperBin && !!whisperModel },
      frames: frameIndex?.frames.length ?? 0,
      ...(frameIndex ? { frame_source: frameIndex.source } : {}),
    };
    await store.save(s);
    return s;
  } catch (e) {
    // ここに来るのは events が壊れている等の想定外。状態だけは確定させる
    s.status = "failed";
    warn("finalize_failed", (e as Error).stack?.slice(0, 1000) ?? String(e));
    s.finalize = { finished_at_wall: new Date().toISOString(), elapsed_ms: elapsed, tools: { ffmpeg: !!ffmpeg, whisper: !!whisperBin }, frames: 0 };
    await store.save(s).catch(() => {});
    return s;
  }
}

async function finalizeRecorder(
  rec: Recorder,
  dir: string,
  ctx: { ffmpeg: string | null; ffprobe: string | null; warn: (code: string, detail: string) => void; log: (m: string) => void },
): Promise<void> {
  const final = path.join(dir, rec.file);
  const part = path.join(dir, "media", `${rec.id}.webm.part`);
  await fs.mkdir(path.dirname(final), { recursive: true });

  if (await exists(part)) {
    if (ctx.ffmpeg) {
      const r = await remux(ctx.ffmpeg, part, final);
      if (r.code === 0 && (await exists(final))) {
        await fs.unlink(part);
        ctx.log(`[finalize] remuxed ${rec.id}`);
      } else {
        ctx.warn("remux_failed", `${rec.id}: ${r.stderr.slice(-300)}`);
        if (!(await exists(final))) await fs.rename(part, final);
      }
    } else {
      // 生のまま .webm にしておけば Chrome では再生できる（シーク不可）。後で ffmpeg を入れて再実行すれば再 mux される
      await fs.rename(part, final);
      ctx.warn("remux_skipped", `${rec.id}: ffmpeg が無いため再 mux せずに保存しました（Duration/Cues なし）`);
    }
  }

  if (!(await exists(final))) return;
  if (!ctx.ffprobe) return;

  let dur = await probeDurationMs(ctx.ffprobe, final);
  if (dur === null && ctx.ffmpeg) {
    // Duration が無い＝前回 ffmpeg 無しで保存した生 WebM。今回再 mux する
    const tmp = `${final}.remux.tmp.webm`;
    const r = await remux(ctx.ffmpeg, final, tmp);
    if (r.code === 0 && (await exists(tmp))) {
      await fs.rename(tmp, final);
      dur = await probeDurationMs(ctx.ffprobe, final);
    } else {
      await fs.rm(tmp, { force: true });
    }
  }
  if (dur === null) {
    ctx.warn("duration_unknown", `${rec.id}: メディア長を取得できません`);
    return;
  }
  rec.media_duration_ms = dur;
  if (rec.t_rec_start !== undefined && rec.t_rec_stop !== undefined && rec.t_rec_stop > rec.t_rec_start) {
    const raw = (rec.t_rec_stop - rec.t_rec_start) / dur;
    const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
    if (raw !== clamped) {
      ctx.warn("scale_out_of_range", `${rec.id}: scale=${raw.toFixed(4)}（録画 ${rec.t_rec_stop - rec.t_rec_start}ms / メディア ${dur}ms）。${clamped} に丸めました`);
    }
    rec.scale = Math.round(clamped * 1e6) / 1e6;
  }
}

export { FRAME_INDEX_REL };
