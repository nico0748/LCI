import type { Problem, RunResult } from "@lci/core";
import { isRunnerLanguage, type Backend, type JudgeRequest, type RunRequest, type Runner, type RunnerLanguage, type RunnerStatus, type WarmOptions, type WarmProgress } from "./types.ts";
import { DockerBackend, type DockerBackendOptions } from "./backend-docker.ts";
import { FakeBackend } from "./backend-fake.ts";
import { judgeProblem, runOnce } from "./judge.ts";

/**
 * Backend に同時実行制御（02 FR-X-01-5: 言語ごと 1、全体 2）を足した公開オブジェクト。
 * ウォームコンテナは言語ごとに 1 本なので、同じ言語の実行は直列にしないと
 * 「コンテナの OOM ＝ その実行の OOM」という前提（02 R3）が崩れる。
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  private max: number;
  constructor(max: number) {
    this.max = max;
  }
  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
    } else {
      await new Promise<void>((r) => this.queue.push(r));
      this.active++;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.queue.shift()?.();
    };
  }
}

export class RunnerImpl implements Runner {
  readonly backend: "docker" | "fake";
  private global = new Semaphore(2);
  private perLang = new Map<RunnerLanguage, Semaphore>();

  private impl: Backend;

  constructor(impl: Backend) {
    this.impl = impl;
    this.backend = impl.kind;
  }

  private async withSlot<T>(language: string, fn: () => Promise<T>): Promise<T> {
    if (!isRunnerLanguage(language)) return fn(); // 対象外言語は judge 側が IE を返す
    let s = this.perLang.get(language);
    if (!s) {
      s = new Semaphore(1);
      this.perLang.set(language, s);
    }
    const releaseLang = await s.acquire();
    try {
      const releaseGlobal = await this.global.acquire();
      try {
        return await fn();
      } finally {
        releaseGlobal();
      }
    } finally {
      releaseLang();
    }
  }

  status(): Promise<RunnerStatus> {
    return this.impl.status();
  }

  warm(opts?: WarmOptions): AsyncGenerator<WarmProgress> {
    return this.impl.warm(opts);
  }

  run(req: RunRequest): Promise<RunResult> {
    return this.withSlot(req.language, () => runOnce(this.impl, req));
  }

  judge(problem: Problem, req: JudgeRequest): Promise<RunResult> {
    return this.withSlot(req.language, () => judgeProblem(this.impl, problem, req));
  }
}

export function createRunner(kind: "docker" | "fake" = "docker", opts: DockerBackendOptions = {}): Runner {
  return new RunnerImpl(kind === "fake" ? new FakeBackend() : new DockerBackend(opts));
}

/** Next.js dev はモジュールを再評価することがあるので globalThis に保持する（apps/web/src/lib/server.ts と同じ理由） */
const g = globalThis as unknown as { __lciRunner?: Runner };

/** 既定は DockerBackend。`LCI_RUNNER=fake` でホスト直実行（テスト・開発用） */
export function getRunner(opts: DockerBackendOptions = {}): Runner {
  if (!g.__lciRunner) {
    const kind = process.env.LCI_RUNNER === "fake" ? "fake" : "docker";
    g.__lciRunner = createRunner(kind, opts);
  }
  return g.__lciRunner;
}
