import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AudioManifest } from "../schema.ts";
import type { AudioJobStatus } from "../types.ts";
import { TIMING, estimateSayMs, stepReading } from "../compile.ts";
import { sanitizeForSay } from "../readings.ts";
import type { AudioJob, DemoStore } from "../store.ts";
import { resolveEngine, ttsConfigFromEnv, type TtsEngine } from "./engines.ts";

/**
 * 音声の合成ジョブ（02 §7.2、00 D10）。保存後にアプリ側（Next の POST /api/demos/<id>/audio、
 * または MCP の save が起動する切り離した子プロセス）で区間ごとに合成する。台本から作り直せる派生キャッシュ。
 * - 区間キー = sha256(engine|voice|rate|正規化した読み).slice(0,16)。既にある区間は作らない（直した区間だけ作り直す）
 * - 進捗は audio/job-rev-NNNN.json（ポーリング用）。同時実行は audio/.synth.lock（O_EXCL＋心拍）で防ぐ
 * - 完了したら manifest-rev-NNNN.json を原子的に書く（途中の版は出さない）
 */

export const AUDIO_MAX_BYTES_PER_DEMO = 8 * 1024 * 1024;
const STALE_MS = 120_000;

export class AudioBusyError extends Error {
  constructor() {
    super("この版の音声はすでに合成中です");
    this.name = "AudioBusyError";
  }
}

export function segmentKey(engine: string, voice: string, rate: number, reading: string): string {
  return createHash("sha256").update(`${engine}|${voice}|${rate}|${sanitizeForSay(reading)}`).digest("hex").slice(0, 16);
}

export interface SynthOptions {
  engine?: TtsEngine;
  env?: NodeJS.ProcessEnv;
  revision?: number;
  /** 既存の区間も作り直す */
  force?: boolean;
  log?: (m: string) => void;
  /** 同じデモの別の版を合成中なら、終わるまで最大この時間待つ（既定 0 = 待たずに AudioBusyError） */
  waitMs?: number;
}

interface JobWithSegments extends AudioJob {
  segments?: AudioManifest["segments"];
}

function alive(pid: number): boolean {
  if (!pid || pid === process.pid) return pid === process.pid;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** 合成中か（心拍が新しく、プロセスが生きている） */
export function jobIsLive(job: AudioJob | null): boolean {
  return !!job && job.status === "generating" && Date.now() - Date.parse(job.updated_at) < STALE_MS && alive(job.pid);
}

async function acquire(lock: string): Promise<boolean> {
  await fs.mkdir(path.dirname(lock), { recursive: true });
  try {
    const h = await fs.open(lock, "wx");
    await h.writeFile(String(process.pid));
    await h.close();
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const st = await fs.stat(lock).catch(() => null);
    const pid = Number(await fs.readFile(lock, "utf8").catch(() => "0"));
    if (!st || Date.now() - st.mtimeMs > STALE_MS || !alive(pid)) {
      await fs.rm(lock, { force: true });
      return acquire(lock);
    }
    return false;
  }
}

/** 声ごとの較正（02 §4.3）: 実測 / 推定 の比。以後の推定に使う */
export interface Calibration {
  [engineVoiceRate: string]: { ratio: number; segments: number; updated_at: string };
}

export function calibrationKey(engine: string, voice: string, rate: number): string {
  return `${engine}|${voice}|${rate}`;
}

export async function readCalibration(dataRoot: string): Promise<Calibration> {
  try {
    return JSON.parse(await fs.readFile(path.join(dataRoot, "demos", "_tts", "calibration.json"), "utf8")) as Calibration;
  } catch {
    return {};
  }
}

/** 環境変数で決まる声の較正から、推定に使う読み速度（読み文字/秒）を返す */
export async function calibratedReadingCps(dataRoot: string, env: NodeJS.ProcessEnv = process.env): Promise<number | undefined> {
  const cfg = ttsConfigFromEnv(env);
  if (cfg.engine === "none" || cfg.engine === "fake") return undefined;
  const c = (await readCalibration(dataRoot))[calibrationKey("say", cfg.voice, cfg.rate)];
  if (!c || !(c.ratio > 0)) return undefined;
  return TIMING.readingCps / Math.min(2, Math.max(0.5, c.ratio));
}

async function writeCalibration(dataRoot: string, key: string, ratio: number, segments: number): Promise<void> {
  const file = path.join(dataRoot, "demos", "_tts", "calibration.json");
  const cur = await readCalibration(dataRoot);
  cur[key] = { ratio: Math.round(ratio * 1000) / 1000, segments, updated_at: new Date().toISOString() };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(cur, null, 1));
  await fs.rename(tmp, file);
}

/** 版の音声の状態（API と MCP の list で使う） */
export async function audioStatusOf(store: DemoStore, demoId: string, revision: number, opts: { engineAvailable: boolean }): Promise<AudioJobStatus & { manifest: AudioManifest | null }> {
  const manifest = await store.readManifest(demoId, revision);
  const job = await store.readJob(demoId, revision);
  const base = { revision, done: job?.done ?? 0, total: job?.total ?? 0, engine: job?.engine ?? manifest?.engine, voice: job?.voice ?? manifest?.voice, error: job?.error, updated_at: job?.updated_at };
  if (jobIsLive(job)) return { ...base, status: "generating", manifest };
  if (manifest) return { ...base, status: "ready", done: manifest.segments.length, total: manifest.segments.length, manifest };
  if (job?.status === "failed") return { ...base, status: "failed", manifest };
  return { ...base, status: opts.engineAvailable ? "none" : "unavailable", manifest };
}

/**
 * 版の音声を合成して AudioManifest を書く。すでに合成中なら AudioBusyError。
 * dataRoot は store.root の親（較正ファイルの置き場所）。
 */
export async function synthesizeDemo(store: DemoStore, demoId: string, opts: SynthOptions = {}): Promise<AudioManifest> {
  const log = opts.log ?? (() => undefined);
  const idx = await store.index(demoId);
  if (!idx) throw new Error(`デモが見つかりません: ${demoId}`);
  const revision = opts.revision ?? idx.current_revision;
  const script = await store.getScript(demoId, revision);
  if (!script) throw new Error(`版が見つかりません: ${demoId} rev ${revision}`);
  let engine = opts.engine ?? null;
  if (!engine) {
    const r = await resolveEngine(opts.env ?? process.env, { checkVoice: true });
    if (!r.engine) throw new Error(r.reason ?? "音声エンジンがありません");
    engine = r.engine;
  }
  const audioDir = (await store.audioDir(demoId))!;
  const lock = path.join(audioDir, ".synth.lock");
  const items = script.draft.steps
    .map((s) => ({ step_id: s.id, reading: stepReading(s, script.draft.glossary) }))
    .filter((x): x is { step_id: string; reading: string } => !!x.reading);
  if (!(await acquire(lock))) {
    // 同じデモの別の版（例: 直してすぐ保存した次の版）を合成中。待つ間もこの版の job を「合成中」に見せる
    const waitUntil = Date.now() + (opts.waitMs ?? 0);
    if (Date.now() >= waitUntil) throw new AudioBusyError();
    const own = await store.readJob(demoId, revision);
    if (jobIsLive(own)) throw new AudioBusyError();
    const now = new Date().toISOString();
    const waiting: AudioJob = { status: "generating", revision, done: 0, total: items.length, engine: engine.id, voice: engine.voice, pid: process.pid, started_at: now, updated_at: now };
    log(`[demo-tts] ${demoId} rev${revision} 別の版の合成が終わるのを待ちます`);
    let got = false;
    while (Date.now() < waitUntil) {
      waiting.updated_at = new Date().toISOString();
      await store.writeJob(demoId, waiting);
      await new Promise((r) => setTimeout(r, 1000));
      if (!(await store.index(demoId))?.revisions.some((r) => r.revision === revision)) throw new Error(`版が削除されました: ${demoId} rev ${revision}`);
      if ((got = await acquire(lock))) break;
    }
    if (!got) {
      waiting.status = "failed";
      waiting.error = "別の版の合成が終わらないため中止しました";
      await store.writeJob(demoId, waiting).catch(() => undefined);
      throw new AudioBusyError();
    }
  }
  const started_at = new Date().toISOString();
  // 前のジョブ・他の版のマニフェストで長さが分かっている区間は作り直さない
  const known = new Map<string, { duration_ms: number; bytes: number }>();
  if (!opts.force) {
    for (const r of idx.revisions) {
      for (const s of (await store.readManifest(demoId, r.revision))?.segments ?? []) known.set(s.key, { duration_ms: s.duration_ms, bytes: s.bytes });
      const j = (await store.readJob(demoId, r.revision)) as JobWithSegments | null;
      for (const s of j?.segments ?? []) known.set(s.key, { duration_ms: s.duration_ms, bytes: s.bytes });
    }
  }
  const job: JobWithSegments = {
    status: "generating",
    revision,
    done: 0,
    total: items.length,
    engine: engine.id,
    voice: engine.voice,
    pid: process.pid,
    started_at,
    updated_at: started_at,
    segments: [],
  };
  const beat = async () => {
    job.updated_at = new Date().toISOString();
    await store.writeJob(demoId, job);
    const now = new Date();
    await fs.utimes(lock, now, now).catch(() => undefined);
  };
  try {
    await beat();
    let estTotal = 0;
    let measuredTotal = 0;
    let made = 0;
    for (const it of items) {
      const key = segmentKey(engine.id, engine.voice, engine.rate, it.reading);
      const file = (await store.segmentPath(demoId, key))!;
      const st = await fs.stat(file).catch(() => null);
      let seg = st && st.size > 0 ? known.get(key) : undefined;
      if (!seg) {
        const r = await engine.synth(it.reading, file);
        seg = { duration_ms: Math.max(1, Math.round(r.duration_ms)), bytes: r.bytes };
        made++;
        estTotal += estimateSayMs(it.reading);
        measuredTotal += seg.duration_ms;
      }
      job.segments!.push({ step_id: it.step_id, key, duration_ms: seg.duration_ms, bytes: seg.bytes });
      job.done++;
      await beat();
      log(`[demo-tts] ${demoId} rev${revision} ${job.done}/${job.total} ${it.step_id} ${seg.duration_ms}ms`);
    }
    const total_bytes = job.segments!.reduce((a, s) => a + s.bytes, 0);
    if (total_bytes > AUDIO_MAX_BYTES_PER_DEMO) throw new Error(`音声が ${Math.round(total_bytes / 1024 / 1024)} MB になり、上限 8 MB を超えました`);
    const manifest: AudioManifest = {
      engine: engine.id,
      voice: engine.voice,
      rate: engine.rate,
      format: "m4a",
      engine_info: engine.info,
      segments: job.segments!,
      total_bytes,
      generated_at: new Date().toISOString(),
    };
    await store.writeManifest(demoId, revision, manifest);
    job.status = "done";
    await beat();
    if (made >= 3 && estTotal > 0 && engine.id === "say") await writeCalibration(path.dirname(store.root), calibrationKey(engine.id, engine.voice, engine.rate), measuredTotal / estTotal, made);
    await enforceAudioBudget(store, demoId, opts.env ?? process.env).catch(() => undefined);
    return manifest;
  } catch (e) {
    job.status = "failed";
    job.error = e instanceof Error ? e.message : String(e);
    await beat().catch(() => undefined);
    throw e;
  } finally {
    await fs.rm(lock, { force: true }).catch(() => undefined);
  }
}

/** 全デモの音声が LCI_DEMO_AUDIO_MAX_MB（既定 500）を超えたら、古い音声から消す（台本は消さない。02 §9） */
export async function enforceAudioBudget(store: DemoStore, keepDemoId: string, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const maxMb = Number(env.LCI_DEMO_AUDIO_MAX_MB ?? 500);
  const cap = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 500) * 1024 * 1024;
  const all = (await store.totalAudioBytes()).sort((a, b) => a.updated - b.updated);
  let sum = all.reduce((a, x) => a + x.bytes, 0);
  let freed = 0;
  for (const d of all) {
    if (sum <= cap) break;
    if (d.demo_id === keepDemoId) continue;
    const r = await store.remove(d.demo_id, { audioOnly: true });
    sum -= r?.freed_bytes ?? 0;
    freed += r?.freed_bytes ?? 0;
  }
  return freed;
}
