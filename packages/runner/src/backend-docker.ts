import { spawn } from "node:child_process";
import path from "node:path";
import { RUNNER_LANGUAGES, InfraError, type Backend, type ExecOptions, type ExecResult, type RunnerLanguage, type RunnerStatus, type SourceFile, type WarmOptions, type WarmProgress, type Workspace } from "./types.ts";
import { IMAGE_SHORT, containerName, imageName, isSafePath } from "./languages.ts";
import { buildTar } from "./tar.ts";

/**
 * `docker` CLI を child_process で叩くバックエンド（02 FR-X-01）。
 * dockerode ではなく CLI にしたのは、Docker Desktop / OrbStack のソケット位置や
 * コンテキスト切替を CLI 側に任せられるため。
 *
 * 言語ごとに 1 本のウォームコンテナ `lci-<lang>` を `sleep infinity` で常駐させ、
 * 実行は `docker exec -i ... /opt/lci/run.sh` で行う（run.sh は docker/run.sh、イメージに焼き込む）。
 */

const LABEL = "lci.lang";

export interface DockerBackendOptions {
  dockerBin?: string;
  /** Dockerfile のディレクトリ。warm() の既定値 */
  dockerDir?: string;
}

interface DockerOut {
  code: number;
  stdout: Buffer;
  stderr: string;
  /** spawn 自体の失敗（ENOENT など） */
  error?: string;
}

function runDocker(bin: string, args: string[], opts: { stdin?: Buffer; timeoutMs?: number } = {}): Promise<DockerOut> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: -1, stdout: Buffer.alloc(0), stderr: "", error: String(e) });
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let error: string | undefined;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          error = `docker ${args[0]} が ${opts.timeoutMs}ms 以内に終わりませんでした`;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : undefined;
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));
    child.on("error", (e) => {
      error = (e as NodeJS.ErrnoException).code === "ENOENT" ? "ENOENT" : String(e);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8"), error });
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(opts.stdin ?? Buffer.alloc(0));
  });
}

/** docker build のような長い処理を行単位でストリームする */
function streamDocker(bin: string, args: string[]): { lines: AsyncIterable<string>; code: Promise<number> } {
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  const queue: string[] = [];
  let waiting: (() => void) | undefined;
  let closed = false;
  let partial = "";
  const push = (chunk: Buffer) => {
    partial += chunk.toString("utf8");
    const parts = partial.split("\n");
    partial = parts.pop() ?? "";
    for (const p of parts) queue.push(p);
    waiting?.();
  };
  child.stdout.on("data", push);
  child.stderr.on("data", push);
  const code = new Promise<number>((res) => {
    child.on("error", () => {
      closed = true;
      waiting?.();
      res(-1);
    });
    child.on("close", (c) => {
      if (partial) queue.push(partial);
      closed = true;
      waiting?.();
      res(c ?? -1);
    });
  });
  const lines: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length) {
          yield queue.shift()!;
          continue;
        }
        if (closed) return;
        await new Promise<void>((r) => (waiting = r));
        waiting = undefined;
      }
    },
  };
  return { lines, code };
}

/**
 * ウォームコンテナの起動引数（02 FR-X-01-2）。テストから検証できるよう関数にしている。
 * --init: sleep が PID 1 だと kill された子がゾンビとして残り pids-limit を食いつぶすため tini で回収する。
 * --memory-swap = --memory: スワップで上限が実質 2 倍になるのを防ぐ。
 * /tmp にも exec を付ける: `go test` はテストバイナリを TMPDIR に置いて実行する。
 * Go だけ GOCACHE を名前付きボリュームにする: read-only rootfs でもビルドキャッシュに書けるようにし、
 * 初回はイメージ内の事前生成キャッシュ（/gocache）がボリュームへコピーされる。
 */
export function containerRunArgs(lang: RunnerLanguage): string[] {
  const args = [
    "run",
    "-d",
    "--init",
    "--name",
    containerName(lang),
    "--label",
    `${LABEL}=${lang}`,
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    "/work:rw,exec,nosuid,size=256m",
    "--tmpfs",
    "/tmp:rw,exec,nosuid,size=64m",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "128",
    "--memory",
    "512m",
    "--memory-swap",
    "512m",
    "--cpus",
    "1",
    "--user",
    "1000:1000",
    "-e",
    "HOME=/tmp",
    "-e",
    "TMPDIR=/tmp",
  ];
  if (lang === "go") args.push("-v", "lci-gocache:/gocache");
  args.push(imageName(lang), "sleep", "infinity");
  return args;
}

/** run.sh の 1 行目を解釈してバイト単位で stdout / stderr を切り出す */
export function parseRunOutput(buf: Buffer, capBytes: number, wallMs: number): ExecResult | { error: string } {
  const nl = buf.indexOf(0x0a);
  if (nl < 0) return { error: `run.sh の応答が不正です: ${buf.toString("utf8", 0, 200)}` };
  const header = buf.toString("ascii", 0, nl).trim().split(/\s+/);
  if (header[0] !== "LCI1" || header.length < 6) return { error: `run.sh の応答が不正です: ${header.join(" ").slice(0, 200)}` };
  const exitCode = Number(header[1]);
  const elapsedUs = Number(header[2]);
  const oomDelta = Number(header[3]);
  const outLen = Number(header[4]);
  const errLen = Number(header[5]);
  const outTake = Math.min(outLen, capBytes);
  const errTake = Math.min(errLen, capBytes);
  const outStart = nl + 1;
  const stdout = buf.toString("utf8", outStart, outStart + outTake);
  const stderr = buf.toString("utf8", outStart + outTake, outStart + outTake + errTake);
  const timeMs = Math.round(elapsedUs / 1000);
  // timeout -s KILL は 137 を返す。経過時間が上限に達していれば TLE、そうでない 137 は OOM の疑い
  const timedOut = (exitCode === 137 || exitCode === 124) && timeMs >= wallMs - 50;
  return {
    exitCode,
    timeMs,
    stdout,
    stderr,
    stdoutBytes: outLen,
    stderrBytes: errLen,
    timedOut,
    outputExceeded: outLen + errLen > capBytes || exitCode === 153,
    oomKilled: oomDelta > 0,
  };
}

export class DockerBackend implements Backend {
  readonly kind = "docker" as const;
  private bin: string;
  private dockerDir: string | undefined;
  /** inspect 済みで running と分かっているコンテナ。失敗したら外す */
  private known = new Set<RunnerLanguage>();

  constructor(opts: DockerBackendOptions = {}) {
    this.bin = opts.dockerBin ?? process.env.LCI_DOCKER_BIN ?? "docker";
    this.dockerDir = opts.dockerDir ?? process.env.LCI_DOCKER_DIR;
  }

  image(lang: RunnerLanguage): string {
    return imageName(lang);
  }

  private docker(args: string[], opts?: { stdin?: Buffer; timeoutMs?: number }) {
    return runDocker(this.bin, args, opts);
  }

  async isRunning(lang: RunnerLanguage): Promise<boolean | "absent"> {
    const r = await this.docker(["inspect", "-f", "{{.State.Running}}", containerName(lang)], { timeoutMs: 10000 });
    if (r.code !== 0) return "absent";
    return r.stdout.toString("utf8").trim() === "true";
  }

  async start(lang: RunnerLanguage): Promise<void> {
    const r = await this.docker(containerRunArgs(lang), { timeoutMs: 60000 });
    if (r.code !== 0) {
      // デーモン不通を先に判定する（CLI のバージョンで文言が違う: "Cannot connect to the Docker daemon" / "failed to connect to the docker API"）
      if (r.error || /Cannot connect|failed to connect|docker daemon|docker API|docker\.sock/i.test(r.stderr)) {
        throw new InfraError(r.error === "ENOENT" ? "docker コマンドが見つかりません" : "Docker が起動していません（Docker Desktop / OrbStack を起動してください）");
      }
      if (/No such image|pull access denied|Unable to find image/i.test(r.stderr)) {
        throw new InfraError(`イメージ ${imageName(lang)} がありません。「イメージを取得」（pnpm runner:warm）を実行してください`);
      }
      throw new InfraError(`コンテナ起動に失敗: ${r.stderr.trim().slice(0, 300)}`);
    }
    this.known.add(lang);
  }

  async ensureContainer(lang: RunnerLanguage): Promise<void> {
    if (this.known.has(lang)) return;
    const st = await this.isRunning(lang);
    if (st === true) {
      this.known.add(lang);
      return;
    }
    if (st === false) await this.docker(["rm", "-f", containerName(lang)], { timeoutMs: 30000 });
    await this.start(lang);
  }

  /** TLE/OOM 後の破棄・再作成（02 FR-X-01-4）。目標 ≤ 2 s */
  async recreate(lang: RunnerLanguage): Promise<void> {
    this.known.delete(lang);
    await this.docker(["rm", "-f", containerName(lang)], { timeoutMs: 30000 });
    await this.start(lang);
  }

  async open(lang: RunnerLanguage, files: SourceFile[]): Promise<Workspace> {
    for (const f of files) if (!isSafePath(f.path)) throw new InfraError(`不正なファイルパス: ${f.path}`);
    await this.ensureContainer(lang);
    const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const tar = buildTar(files);
    const upload = async () =>
      this.docker(["exec", "-i", containerName(lang), "sh", "-c", `mkdir -p /work/${id} && tar -x -C /work/${id}`], { stdin: tar, timeoutMs: 30000 });
    let r = await upload();
    if (r.code !== 0 && /is not running|No such container|not found/i.test(r.stderr)) {
      // 外部で止められた／消されたコンテナ: 1 回だけ作り直して再試行
      await this.recreate(lang);
      r = await upload();
    }
    if (r.code !== 0) {
      this.known.delete(lang);
      throw new InfraError(`ファイル配置に失敗: ${r.stderr.trim().slice(0, 300) || r.error || `exit ${r.code}`}`);
    }
    return new DockerWorkspace(this, lang, id);
  }

  async execInContainer(lang: RunnerLanguage, id: string, cmd: string[], opts: ExecOptions): Promise<ExecResult> {
    const capBytes = opts.limits.outputKb * 1024;
    const wallSec = (opts.limits.wallMs / 1000).toFixed(3);
    // ulimit -v は仮想メモリなので RSS 上限の 2 倍を許す。実 RSS はコンテナの cgroup（512m）が止める
    const memKb = opts.applyMemLimit && opts.limits.memoryMb ? opts.limits.memoryMb * 1024 * 2 : 0;
    const args = ["exec", "-i", "-w", `/work/${id}`, containerName(lang), "/opt/lci/run.sh", wallSec, String(memKb), String(capBytes), "--", ...cmd];
    const r = await this.docker(args, { stdin: Buffer.from(opts.stdin ?? "", "utf8"), timeoutMs: opts.limits.wallMs + 20000 });
    if (r.error || r.code !== 0) {
      this.known.delete(lang);
      const msg = r.error === "ENOENT" ? "docker コマンドが見つかりません" : r.stderr.trim().slice(0, 300) || r.error || `docker exec exit ${r.code}`;
      return { exitCode: -1, timeMs: 0, stdout: "", stderr: "", stdoutBytes: 0, stderrBytes: 0, timedOut: false, outputExceeded: false, oomKilled: false, error: msg };
    }
    const parsed = parseRunOutput(r.stdout, capBytes, opts.limits.wallMs);
    if ("error" in parsed && !("exitCode" in parsed)) {
      return { exitCode: -1, timeMs: 0, stdout: "", stderr: r.stderr, stdoutBytes: 0, stderrBytes: 0, timedOut: false, outputExceeded: false, oomKilled: false, error: parsed.error };
    }
    return parsed as ExecResult;
  }

  async cleanup(lang: RunnerLanguage, id: string): Promise<void> {
    await this.docker(["exec", containerName(lang), "rm", "-rf", `/work/${id}`], { timeoutMs: 15000 });
  }

  async status(): Promise<RunnerStatus> {
    const images = RUNNER_LANGUAGES.map((lang) => ({ lang, image: imageName(lang), present: false }));
    const containers = RUNNER_LANGUAGES.map((lang) => ({ lang, name: containerName(lang), state: "absent" as const }));
    const v = await this.docker(["version", "--format", "{{.Server.Version}}"], { timeoutMs: 8000 });
    if (v.error === "ENOENT") return { docker: "missing", backend: "docker", images, containers };
    if (v.code !== 0 || v.error) return { docker: "not_running", backend: "docker", images, containers };

    const im = await this.docker(["images", "--format", "{{.Repository}}:{{.Tag}}", "--filter", "reference=lci/*"], { timeoutMs: 10000 });
    const present = new Set(im.stdout.toString("utf8").split("\n").map((s) => s.trim()).filter(Boolean));
    for (const i of images) i.present = present.has(i.image);

    const ps = await this.docker(["ps", "-a", "--filter", `label=${LABEL}`, "--format", "{{.Names}}\t{{.State}}"], { timeoutMs: 10000 });
    const states = new Map<string, string>();
    for (const line of ps.stdout.toString("utf8").split("\n")) {
      const [name, state] = line.split("\t");
      if (name && state) states.set(name.trim(), state.trim());
    }
    const out: RunnerStatus["containers"] = containers.map((c) => {
      const s = states.get(c.name);
      return { ...c, state: s === undefined ? "absent" : s === "running" ? "running" : "stopped" };
    });
    return { docker: "ok", backend: "docker", images, containers: out };
  }

  /**
   * イメージを docker/ からビルドし（pull ではなく build: ベースタグ固定で再現性を取る）、コンテナを起動する。
   * 進捗は async generator で返し、Route Handler が SSE に流す。
   */
  async *warm(opts: WarmOptions = {}): AsyncGenerator<WarmProgress> {
    const langs = opts.languages ?? [...RUNNER_LANGUAGES];
    const dockerDir = opts.dockerDir ?? this.dockerDir ?? path.resolve(process.cwd(), "docker");
    const st = await this.status();
    if (st.docker !== "ok") {
      yield { lang: "all", phase: "error", message: st.docker === "missing" ? "docker コマンドが見つかりません" : "Docker が起動していません" };
      return;
    }
    // typescript と node は同じイメージなので 2 回ビルドしない
    const built = new Set<string>();
    for (const lang of langs) {
      const image = imageName(lang);
      const present = st.images.find((i) => i.lang === lang)?.present ?? false;
      try {
        if ((!present || opts.rebuild) && !built.has(image)) {
          yield { lang, phase: "build", message: `${image} をビルドしています` };
          const file = path.join(dockerDir, `${IMAGE_SHORT[lang]}.Dockerfile`);
          const { lines, code } = streamDocker(this.bin, ["build", "--progress=plain", "-t", image, "-f", file, dockerDir]);
          for await (const line of lines) yield { lang, phase: "build", line };
          const c = await code;
          if (c !== 0) {
            yield { lang, phase: "error", message: `${image} のビルドに失敗しました (exit ${c})` };
            continue;
          }
          built.add(image);
        } else {
          yield { lang, phase: "skip", message: `${image} は取得済み` };
        }
        yield { lang, phase: "start", message: `${containerName(lang)} を起動しています` };
        this.known.delete(lang);
        await this.ensureContainer(lang);
        yield { lang, phase: "ready", message: `${containerName(lang)} 準備完了` };
      } catch (e) {
        yield { lang, phase: "error", message: e instanceof Error ? e.message : String(e) };
      }
    }
    yield { lang: "all", phase: "done" };
  }
}

class DockerWorkspace implements Workspace {
  private tainted = false;
  private backend: DockerBackend;
  private lang: RunnerLanguage;
  private id: string;
  constructor(backend: DockerBackend, lang: RunnerLanguage, id: string) {
    this.backend = backend;
    this.lang = lang;
    this.id = id;
  }

  async exec(cmd: string[], opts: ExecOptions): Promise<ExecResult> {
    const r = await this.backend.execInContainer(this.lang, this.id, cmd, opts);
    if (r.error) this.tainted = true;
    return r;
  }

  taint(): void {
    this.tainted = true;
  }

  async close(): Promise<void> {
    if (this.tainted) {
      // 残留プロセス・ファイルを持ち越さないためコンテナごと捨てる。失敗しても次の open で再作成される
      await this.backend.recreate(this.lang).catch(() => undefined);
    } else {
      await this.backend.cleanup(this.lang, this.id).catch(() => undefined);
    }
  }
}
