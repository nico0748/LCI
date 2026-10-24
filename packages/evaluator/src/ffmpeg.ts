import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * 外部コマンド（ffmpeg / ffprobe / whisper-cli）の薄いラッパ。
 * ネイティブ依存はこの 2〜3 本に限定する（要件書 01 §3）。バイナリが無いときは
 * 例外ではなく「見つからない」を返し、呼び出し側が warning を残して処理を続けられるようにする。
 */

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
}

export class ToolMissingError extends Error {
  // パラメータプロパティは --experimental-strip-types で使えないので明示代入
  readonly bin: string;
  constructor(bin: string) {
    super(`外部コマンドが見つかりません: ${bin}`);
    this.bin = bin;
    this.name = "ToolMissingError";
  }
}

/** macOS の GUI 起動プロセスでは Homebrew の bin が PATH に無いことがあるので、既知の場所も探す */
const FALLBACK_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

export async function which(bin: string): Promise<string | null> {
  if (!bin) return null;
  const tryPath = async (p: string) => {
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) return false;
      await fs.access(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  if (bin.includes("/")) return (await tryPath(bin)) ? bin : null;
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean), ...FALLBACK_DIRS];
  for (const d of dirs) {
    const p = path.join(d, bin);
    if (await tryPath(p)) return p;
  }
  return null;
}

export function exec(
  bin: string,
  args: string[],
  opts: { timeoutMs?: number; maxBuffer?: number; cwd?: string } = {},
): Promise<ExecResult> {
  const started = Date.now();
  const maxBuffer = opts.maxBuffer ?? 8 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], cwd: opts.cwd });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          stderr += `\n[timeout ${opts.timeoutMs}ms]`;
        }, opts.timeoutMs)
      : null;
    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < maxBuffer) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < maxBuffer) stderr += d.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      if (err.code === "ENOENT") reject(new ToolMissingError(bin));
      else reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, elapsed_ms: Date.now() - started });
    });
  });
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** ffprobe でコンテナの duration（ms）を得る。生の MediaRecorder WebM は N/A を返すことがあるので null を許す */
export async function probeDurationMs(ffprobe: string, file: string): Promise<number | null> {
  const r = await exec(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
    timeoutMs: 60_000,
  });
  const v = parseFloat(r.stdout.trim());
  if (r.code !== 0 || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 1000);
}

/**
 * WebM を再 mux して Duration と Cues を付ける（FR-C-08）。
 * `-fflags +genpts` は入力側の指定なので `-i` より前に置く。失敗したら
 * `-err_detect ignore_err` で救済を試みる（要件書 01 §6.2）。
 */
export async function remux(ffmpeg: string, src: string, dst: string): Promise<ExecResult> {
  const base = ["-y", "-hide_banner", "-loglevel", "error", "-fflags", "+genpts"];
  let r = await exec(ffmpeg, [...base, "-i", src, "-c", "copy", dst], { timeoutMs: 10 * 60_000 });
  if (r.code !== 0) {
    r = await exec(ffmpeg, [...base, "-err_detect", "ignore_err", "-i", src, "-c", "copy", dst], { timeoutMs: 10 * 60_000 });
  }
  return r;
}

/** 文字起こし入力用の 16kHz モノラル WAV（FR-C-09） */
export async function extractWav16k(ffmpeg: string, src: string, dst: string): Promise<ExecResult> {
  return exec(
    ffmpeg,
    ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", dst],
    { timeoutMs: 10 * 60_000 },
  );
}

/** 1 枚の静止画を切り出す。長辺は maxWidth 以下（Claude 側でリサイズされてトークンだけ増えるのを防ぐ） */
export async function extractFrame(ffmpeg: string, src: string, seconds: number, dst: string, maxWidth = 1280): Promise<ExecResult> {
  return exec(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      seconds.toFixed(3),
      "-i",
      src,
      "-frames:v",
      "1",
      "-vf",
      `scale='min(${maxWidth},iw)':-2`,
      "-q:v",
      "5",
      dst,
    ],
    { timeoutMs: 60_000 },
  );
}
