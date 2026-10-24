import type { Language, RunResult } from "@lci/core";
import type { SessionClock } from "../clock.ts";
import type { SandboxHost } from "./host.ts";
import type { LayoutAssert, MockApi, ScenarioResult, ScenarioSpec } from "./protocol.ts";
import { inferTechniques } from "./techniques.ts";

/**
 * web 判定（要件書 02 FR-X-02-4/5, FR-X-03-4）。
 * シナリオごとに新しい iframe を読み込み、結果を core の RunResult（mode: judge, infra: iframe）にまとめる。
 * 採点自体はブラウザ側で行う（単一ユーザなので改ざん対策は不要、API_CONTRACT 参照）。
 */

export interface WebTestsLike {
  preview?: { tailwind?: "local" | "none" };
  mockApi?: MockApi | null;
  layout?: LayoutAssert[];
  scenarios: ScenarioSpec[];
}

export interface JudgeWebInput {
  host: SandboxHost;
  html: string;
  tests: WebTestsLike;
  language: Language;
  clock: SessionClock;
  seed?: number;
  onProgress?: (done: number, total: number, name: string) => void;
}

export interface TimedScenarioResult {
  result: ScenarioResult;
  /** iframe 時間 → セッション時間の加算値 */
  tOffset: number;
}

export function newRunId(prefix = "web"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 純粋関数: シナリオ結果の配列から RunResult を組み立てる */
export function buildWebRunResult(input: { runId: string; language: Language; startedAtWall: string; t: number; durationMs: number; results: TimedScenarioResult[] }): RunResult {
  const cases: RunResult["cases"] = [];
  const requests: NonNullable<RunResult["behavior"]>["requests"] = [];
  const errors: string[] = [];
  for (const { result, tOffset } of input.results) {
    const failed = [...result.steps.filter((s) => !s.ok).map((s) => `step ${s.index + 1}: ${s.message ?? "失敗"}`), ...result.layout.filter((l) => !l.ok).map((l) => `layout ${l.name}: ${l.message ?? "失敗"}`)];
    const timedOut = result.steps.some((s) => !s.ok && /タイムアウト/.test(s.message ?? ""));
    cases.push({
      name: result.name,
      visibility: "hidden",
      verdict: timedOut ? "TLE" : result.verdict,
      time_ms: result.duration_ms,
      message: failed.length ? failed.join("\n") : undefined,
      stderr: result.errors.length ? result.errors.join("\n") : undefined,
      tags: [],
    });
    for (const r of result.requests) requests.push({ t: Math.round(tOffset + r.t), url: r.url, status: r.status });
    for (const e of result.errors) errors.push(`[${result.name}] ${e}`);
  }
  const allPass = cases.length > 0 && cases.every((c) => c.verdict === "PASS");
  return {
    run_id: input.runId,
    mode: "judge",
    language: input.language,
    started_at_wall: input.startedAtWall,
    t: input.t,
    verdict: allPass ? "PASS" : "FAIL",
    duration_ms: input.durationMs,
    stderr: errors.length ? errors.join("\n") : undefined,
    cases,
    behavior: { requests, techniques: inferTechniques(input.results.map((r) => r.result)) },
    infra: { backend: "iframe" },
  };
}

/** シナリオに問題側の tags を写す（CaseResult.tags は講評用メタデータ） */
function withTags(run: RunResult, tests: WebTestsLike): RunResult {
  const tagMap = new Map(tests.scenarios.map((s) => [s.name, s.tags ?? []]));
  for (const c of run.cases) c.tags = c.name === "layout" ? ["layout"] : (tagMap.get(c.name) ?? []);
  return run;
}

export async function judgeWeb(input: JudgeWebInput): Promise<{ run: RunResult; results: ScenarioResult[] }> {
  const { host, html, tests, clock } = input;
  const startedAtWall = new Date().toISOString();
  const t = clock.now();
  const t0 = performance.now();
  const tailwind = (tests.preview?.tailwind ?? "local") === "local";
  const mockApi = tests.mockApi ?? null;
  const seed = input.seed ?? 1;

  const plan: { scenario: ScenarioSpec; layout?: LayoutAssert[] }[] = [];
  if (tests.layout && tests.layout.length > 0) plan.push({ scenario: { name: "layout", steps: [] }, layout: tests.layout });
  for (const s of tests.scenarios) plan.push({ scenario: s });

  const results: TimedScenarioResult[] = [];
  for (let i = 0; i < plan.length; i++) {
    const { scenario, layout } = plan[i]!;
    input.onProgress?.(i, plan.length, scenario.name);
    // 結果待ちを load より先に登録しておく（レイアウトだけのシナリオは ready 直後に結果が来る）
    const resultP = host.waitScenarioResult(25000);
    let tOffset = 0;
    try {
      const { t_ready } = await host.load({ html, mockApi, scenarioMode: "judge", tailwind, scenario, layout, seed: seed + i });
      tOffset = clock.now() - t_ready;
      results.push({ result: await resultP, tOffset });
    } catch (e) {
      resultP.catch(() => {});
      results.push({
        result: {
          name: scenario.name,
          verdict: "FAIL",
          steps: [{ index: 0, step: scenario.steps[0] ?? { wait: 0 }, ok: false, message: `タイムアウト: ${e instanceof Error ? e.message : String(e)}` }],
          layout: [],
          requests: [],
          clicks: [],
          typed: [],
          errors: [e instanceof Error ? e.message : String(e)],
          duration_ms: 0,
        },
        tOffset,
      });
    }
  }
  input.onProgress?.(plan.length, plan.length, "");
  const run = withTags(
    buildWebRunResult({ runId: newRunId("web"), language: input.language, startedAtWall, t, durationMs: Math.round(performance.now() - t0), results }),
    tests,
  );
  return { run, results: results.map((r) => r.result) };
}
