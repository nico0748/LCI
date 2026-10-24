import { spawn } from "node:child_process";
import { promises as fs, constants as fsc } from "node:fs";
import os from "node:os";
import path from "node:path";
import { RUNNER_LANGUAGES, InfraError, type Backend, type ExecOptions, type ExecResult, type RunnerLanguage, type RunnerStatus, type SourceFile, type WarmOptions, type WarmProgress, type Workspace } from "./types.ts";
import { imageName, isSafePath } from "./languages.ts";

/**
 * Docker を使わないバックエンド。ホストのツールチェーン（gcc / rustc / go / python3 / node / php）を
 * os.tmpdir() 下の作業ディレクトリで直接動かす。隔離は一切しないので、
 * 用途は runner 自身のユニットテストと `LCI_RUNNER=fake` での開発に限る。
 * 壁時計タイムアウトと出力上限は実装する（judge ロジックの検証に必要）。メモリ制限はしない。
 */

const TOOL: Record<RunnerLanguage, string> = { c: "gcc", rust: "rustc", python: "python3", go: "go", typescript: "node", php: "php" };

async function which(bin: string): Promise<boolean> {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    try {
      await fs.access(path.join(dir, bin), fsc.X_OK);
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}

export class FakeBackend implements Backend {
  readonly kind = "fake" as const;
  private root: string | undefined;

  image(lang: RunnerLanguage): string {
    return imageName(lang);
  }

  private async ensureRoot(): Promise<string> {
    if (!this.root) this.root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-fake-"));
    return this.root;
  }

  async open(lang: RunnerLanguage, files: SourceFile[]): Promise<Workspace> {
    if (!(await which(TOOL[lang]))) throw new InfraError(`fake backend: ${TOOL[lang]} がホストに見つかりません`);
    const root = await this.ensureRoot();
    const dir = await fs.mkdtemp(path.join(root, `${lang}-`));
    for (const f of files) {
      if (!isSafePath(f.path)) throw new InfraError(`不正なファイルパス: ${f.path}`);
      const abs = path.join(dir, f.path);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, f.content);
    }
    return new FakeWorkspace(dir);
  }

  async status(): Promise<RunnerStatus> {
    const images = [] as RunnerStatus["images"];
    const containers = [] as RunnerStatus["containers"];
    for (const lang of RUNNER_LANGUAGES) {
      const present = await which(TOOL[lang]);
      images.push({ lang, image: `host:${TOOL[lang]}`, present });
      containers.push({ lang, name: `host:${TOOL[lang]}`, state: present ? "running" : "absent" });
    }
    // fake では「docker が動いている」扱いにして UI の案内を出さない
    return { docker: "ok", backend: "fake", images, containers };
  }

  async *warm(opts?: WarmOptions): AsyncGenerator<WarmProgress> {
    for (const lang of opts?.languages ?? RUNNER_LANGUAGES) {
      yield { lang, phase: (await which(TOOL[lang])) ? "ready" : "error", message: `fake backend: ${TOOL[lang]}` };
    }
    yield { lang: "all", phase: "done" };
  }
}

class FakeWorkspace implements Workspace {
  // パラメータプロパティは --experimental-strip-types で使えないので明示的に代入する
  private dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  taint(): void {
    /* ホスト実行なので何もしない */
  }

  async close(): Promise<void> {
    await fs.rm(this.dir, { recursive: true, force: true }).catch(() => undefined);
  }

  exec(cmd: string[], opts: ExecOptions): Promise<ExecResult> {
    const [bin, ...args] = cmd;
    const cap = opts.limits.outputKb * 1024;
    const start = performance.now();
    return new Promise<ExecResult>((resolve) => {
      let child;
      try {
        child = spawn(bin!, args, {
          cwd: this.dir,
          // 新しいプロセスグループにして、TLE 時に子孫ごと kill できるようにする
          detached: process.platform !== "win32",
          stdio: ["pipe", "pipe", "pipe"],
          env: cleanEnv(this.dir),
        });
      } catch (e) {
        resolve(failed(String(e)));
        return;
      }
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let outBytes = 0;
      let errBytes = 0;
      let timedOut = false;
      let outputExceeded = false;
      let settled = false;
      let spawnError: string | undefined;

      const killGroup = () => {
        try {
          if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      };
      const timer = setTimeout(() => {
        timedOut = true;
        killGroup();
      }, opts.limits.wallMs);

      const onData = (buf: Buffer[], isOut: boolean) => (chunk: Buffer) => {
        if (isOut) outBytes += chunk.length;
        else errBytes += chunk.length;
        if (outBytes + errBytes > cap) {
          if (!outputExceeded) {
            outputExceeded = true;
            killGroup();
          }
          return;
        }
        buf.push(chunk);
      };
      child.stdout.on("data", onData(out, true));
      child.stderr.on("data", onData(err, false));
      child.on("error", (e) => {
        spawnError = (e as NodeJS.ErrnoException).code === "ENOENT" ? `${bin} が見つかりません` : String(e);
      });
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const timeMs = Math.round(performance.now() - start);
        if (spawnError) {
          resolve(failed(spawnError));
          return;
        }
        const exitCode = code ?? (signal ? 128 + (os.constants.signals[signal] ?? 9) : -1);
        resolve({
          exitCode,
          timeMs,
          stdout: Buffer.concat(out).toString("utf8"),
          stderr: Buffer.concat(err).toString("utf8"),
          stdoutBytes: outBytes,
          stderrBytes: errBytes,
          timedOut,
          outputExceeded,
          oomKilled: false,
        });
      });
      child.stdin.on("error", () => undefined); // 入力を読まずに終了するプログラム向け (EPIPE)
      child.stdin.end(opts.stdin ?? "");
    });
  }
}

/**
 * 子プロセスの環境変数。
 * - NODE_TEST_CONTEXT / NODE_OPTIONS: 外側の `node --test` から漏れると、ハーネスの node:test が
 *   TAP ではなく親プロセス向けの IPC で結果を返してしまう
 * - TMPDIR を作業ディレクトリと別にする: go は TMPDIR 直下の go.mod を無視する
 */
function cleanEnv(dir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, LC_ALL: "C.UTF-8", NO_COLOR: "1", NODE_DISABLE_COLORS: "1" };
  for (const k of Object.keys(env)) if (k.startsWith("NODE_TEST") || k === "NODE_OPTIONS" || k === "FORCE_COLOR") delete env[k];
  env.TMPDIR = path.dirname(dir);
  return env;
}

function failed(error: string): ExecResult {
  return { exitCode: -1, timeMs: 0, stdout: "", stderr: "", stdoutBytes: 0, stderrBytes: 0, timedOut: false, outputExceeded: false, oomKilled: false, error };
}
