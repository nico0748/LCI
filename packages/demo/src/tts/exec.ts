import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * 外部コマンド（say / ffmpeg / ffprobe / afinfo）の薄いラッパ。シェルは介さない（02 §7.2、§10）。
 * @lci/evaluator の ffmpeg.ts と同じ流儀だが、@lci/demo は core + runner だけに依存する（D17）ので小さく持つ。
 */

/** macOS の GUI 起動プロセスでは Homebrew の bin が PATH に無いことがあるので、既知の場所も探す */
const FALLBACK_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

export async function which(bin: string): Promise<string | null> {
  if (!bin) return null;
  const ok = async (p: string) => {
    try {
      const st = await fs.stat(p);
      if (!st.isFile()) return false;
      await fs.access(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  if (bin.includes("/")) return (await ok(bin)) ? bin : null;
  for (const d of [...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean), ...FALLBACK_DIRS]) {
    const p = path.join(d, bin);
    if (await ok(p)) return p;
  }
  return null;
}

export interface RunOut {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function run(bin: string, args: string[], opts: { timeoutMs?: number; cwd?: string } = {}): Promise<RunOut> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], cwd: opts.cwd });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;
    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < 1_000_000) stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < 1_000_000) stderr += d.toString("utf8");
    });
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** ffprobe で長さ（ms）。取れなければ null */
export async function probeDurationMs(ffprobe: string, file: string): Promise<number | null> {
  const r = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { timeoutMs: 30_000 }).catch(() => null);
  if (!r || r.code !== 0) return null;
  const v = parseFloat(r.stdout.trim());
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : null;
}

/** macOS の afinfo で長さ（ffprobe が無いとき）。"estimated duration: 3.123 sec" を拾う（要確認: 出力形式） */
export async function afinfoDurationMs(afinfo: string, file: string): Promise<number | null> {
  const r = await run(afinfo, [file], { timeoutMs: 30_000 }).catch(() => null);
  if (!r || r.code !== 0) return null;
  const m = /estimated duration:\s*([\d.]+)\s*sec/i.exec(r.stdout);
  const v = m ? parseFloat(m[1]!) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : null;
}
