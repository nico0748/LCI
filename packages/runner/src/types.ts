import type { Language, Problem, RunResult } from "@lci/core";

/**
 * runner パッケージの内部型。
 * Backend（docker / fake）は「作業ディレクトリにファイルを置いて、制限付きでコマンドを 1 回実行する」
 * という最小の契約だけを満たす。verdict 判定・比較・結果整形は judge.ts 側で共通化する。
 */

/** Docker で実行する 6 言語（html/javascript/sql/markdown は対象外） */
export const RUNNER_LANGUAGES = ["c", "rust", "python", "go", "typescript", "php"] as const;
export type RunnerLanguage = (typeof RUNNER_LANGUAGES)[number];

export function isRunnerLanguage(x: string): x is RunnerLanguage {
  return (RUNNER_LANGUAGES as readonly string[]).includes(x);
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface ExecLimits {
  /** 壁時計上限。超過で SIGKILL */
  wallMs: number;
  /** ulimit -v / --max-old-space-size などに使う。未指定なら無制限（コンテナの cgroup のみ） */
  memoryMb?: number;
  /** stdout+stderr の合計上限（KiB）。超過は OLE */
  outputKb: number;
}

export interface ExecResult {
  /** プロセス終了コード。timeout による KILL は 137、起動失敗は -1 */
  exitCode: number;
  timeMs: number;
  /** 上限で切り詰めた UTF-8 文字列 */
  stdout: string;
  stderr: string;
  /** 切り詰め前の実バイト数 */
  stdoutBytes: number;
  stderrBytes: number;
  timedOut: boolean;
  outputExceeded: boolean;
  /** cgroup の oom_kill カウンタが増えた（docker のみ） */
  oomKilled: boolean;
  memoryKb?: number;
  /** 基盤側の失敗（docker exec 不可など）。あれば IE */
  error?: string;
}

export interface ExecOptions {
  stdin?: string;
  limits: ExecLimits;
  /** ulimit -v を掛けるか（Go/Node は仮想メモリ予約が大きいので false） */
  applyMemLimit?: boolean;
}

export interface Workspace {
  /** 作業ディレクトリ内で argv を実行する。シェルは介さない（必要なら呼び出し側が bash -c を渡す） */
  exec(cmd: string[], opts: ExecOptions): Promise<ExecResult>;
  /** TLE/OOM/OLE の後に呼ぶ。close() 時にコンテナを破棄・再作成する */
  taint(): void;
  close(): Promise<void>;
}

export type DockerState = "ok" | "not_running" | "missing";

export interface RunnerStatus {
  docker: DockerState;
  backend: "docker" | "fake";
  images: { lang: RunnerLanguage; image: string; present: boolean }[];
  containers: { lang: RunnerLanguage; name: string; state: "running" | "stopped" | "absent" }[];
}

export interface WarmProgress {
  lang: RunnerLanguage | "all";
  phase: "check" | "build" | "start" | "ready" | "skip" | "error" | "done";
  message?: string;
  /** docker build の出力 1 行 */
  line?: string;
}

export interface WarmOptions {
  languages?: RunnerLanguage[];
  /** イメージが存在しても再ビルドする */
  rebuild?: boolean;
  /** Dockerfile のあるディレクトリ（既定: <repo>/docker） */
  dockerDir?: string;
}

export interface Backend {
  readonly kind: "docker" | "fake";
  image(lang: RunnerLanguage): string | undefined;
  /** 作業領域を作りファイルを配置する。基盤障害は InfraError を投げる */
  open(lang: RunnerLanguage, files: SourceFile[]): Promise<Workspace>;
  status(): Promise<RunnerStatus>;
  warm(opts?: WarmOptions): AsyncGenerator<WarmProgress>;
}

export class InfraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfraError";
  }
}

// ---- 公開 API（API_CONTRACT.md の @lci/runner） ---------------------------

export interface RunRequest {
  language: Language;
  files: SourceFile[];
  entry?: string;
  stdin?: string;
  /** セッション時計。未指定なら 0 */
  t?: number;
  limits?: Partial<ExecLimits> & { timeMs?: number };
}

export interface JudgeRequest {
  language: Language;
  files: SourceFile[];
  t?: number;
  /** stdinFile / expectedFile / harness を解決するためのルート */
  problemsRoot: string;
  /** sample のみ実行（Run ボタン用）。既定は全件 */
  visibility?: "sample" | "all";
}

export interface Runner {
  readonly backend: "docker" | "fake";
  status(): Promise<RunnerStatus>;
  warm(opts?: WarmOptions): AsyncGenerator<WarmProgress>;
  run(req: RunRequest): Promise<RunResult>;
  judge(problem: Problem, req: JudgeRequest): Promise<RunResult>;
}
