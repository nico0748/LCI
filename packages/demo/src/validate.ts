import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Language, SessionStore, type Problem, type RunResult } from "@lci/core";
import { compareOutput, getRunner, type Runner } from "@lci/runner";
import { DemoDraft, LIMITS, type RunSnapshot } from "./schema.ts";
import { compileDraft, type StepTimingReport } from "./compile.ts";
import { checkCoverage, checkSelfMetrics, checkStructure, checkSymbols, checkTiming, demoMetrics, lintNarration, type DemoIssue, type SelfMetrics } from "./checks.ts";
import { demoFileFor, findProblemById, sampleCases, unsupportedReason } from "./problem.ts";
import { numberLines, numberedWindows, stableStringify } from "./text.ts";

/**
 * 検証パイプライン（02 §5、00 D8/D9）。validate_demo_script と save_demo_script が共有する。
 * P0 入口 → P1 スキーマ → P2 参照整合 → P3 操作適用 は段ごとに止める。
 * P3 を通れば P4 実行・P5 タイミング・P6 自己採点・P7 網羅・P8 ナレーション lint をまとめて行い、全部のエラーを返す
 * （1 往復で多く直せるように。段内のエラーは最大 20 件）。
 */

export type { DemoIssue } from "./checks.ts";

export interface ValidateInput {
  problem_id: string;
  language: string;
  draft: unknown;
}

export interface ValidateOptions {
  problemsRoot: string;
  dataRoot: string;
  /** 省略時は @lci/runner の getRunner()（LCI_RUNNER で docker / fake） */
  runner?: Runner;
  env?: NodeJS.ProcessEnv;
  /** 推定の読み速度（声の較正値） */
  readingCps?: number;
}

export interface ValidationReport {
  ok: boolean;
  /** 最後に実行した段（P0〜P8）。ok なら "done" */
  stage: string;
  errors: DemoIssue[];
  warnings: DemoIssue[];
  digest?: string;
  runner_backend?: "docker" | "fake";
  estimate?: {
    duration_s: number;
    timing_source: "estimated" | "measured";
    time_limit_s: number;
    ratio_of_limit: number;
    steps: { id: string; chapter: string; t0_s: number; say_s: number; typing_s: number; cps: number | null; silent_typing_s: number }[];
  };
  runs?: Record<string, { mode: string; expect: string; verdict: string; passed: number; total: number; ok: boolean; stdout_head?: string }>;
  final?: { sha256: string; code_numbered: string };
  judge?: { verdict: string; passed: number; total: number; failed: { name: string; verdict: string; message?: string }[] };
  coverage?: { talking_points: Record<string, string[]>; requirements: Record<string, string[]>; red_flags: Record<string, string[]> };
  self_metrics?: SelfMetrics;
}

/** 保存に必要なものすべて（ok のときだけ） */
export interface ValidatedDemo {
  problem: Problem;
  language: Language;
  file: { path: string; base: "starter" | "empty"; base_sha256: string; base_text: string };
  draft: DemoDraft;
  runs: Record<string, RunSnapshot>;
  final_judge: RunSnapshot;
  final_sha256: string;
  final_text: string;
  estimate_ms: number;
  self_metrics: SelfMetrics;
  digest: string;
  runner_backend: "docker" | "fake";
  warnings: DemoIssue[];
}

const MAX_ERRORS = 20;
const MAX_WARNINGS = 50;

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** 台本の digest = sha256(正規化 draft + 基底テキスト + 問題・言語)。音声キャッシュと「検証済みか」の照合に使う */
export function draftDigest(problemId: string, language: string, base: string, draft: DemoDraft): string {
  return sha256(stableStringify({ problem_id: problemId, language, base, draft }));
}

function head(s: string | undefined, max: number): string | undefined {
  if (s === undefined || s === "") return undefined;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** D15: 録画中のセッション。events.jsonl / session.json が staleMs 以上更新されていないものは落ちた録画とみなして数えない */
export async function activeRecordings(dataRoot: string, staleMs = 180_000): Promise<string[]> {
  const store = new SessionStore(dataRoot);
  const out: string[] = [];
  for (const s of await store.list().catch(() => [])) {
    if (s.status !== "recording") continue;
    let latest = 0;
    for (const f of ["events.jsonl", "session.json"]) {
      // data/ 配下は実行時にしか決まらないので、Next のビルド時のファイルトレースから外す
      const st = await fs.stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ store.dir(s.session_id), f)).catch(() => null);
      if (st) latest = Math.max(latest, st.mtimeMs);
    }
    if (Date.now() - latest <= staleMs) out.push(s.session_id);
  }
  return out;
}

export function busyIssue(ids: string[]): DemoIssue {
  return {
    code: "E_BUSY_RECORDING",
    message: `録画中のセッションがあります（${ids.join(", ")}）。録画中はデモの検証・保存・再生をしません（D15）`,
    hint: "セッションを終了してから、もう一度呼んでください（これは台本の問題ではありません）",
  };
}

function snapshotOf(r: RunResult, sampleInputs: Map<string, string>): RunSnapshot {
  const cases = r.cases.slice(0, 20).map((c) => {
    const sample = c.visibility === "sample";
    return {
      name: c.name,
      verdict: c.verdict,
      stdout_head: sample ? head(c.stdout, 1024) : undefined,
      expected_head: sample ? head(c.expected, 1024) : undefined,
      stdin_head: sample ? head(sampleInputs.get(c.name), 1024) : undefined,
      message: head(c.message, 400),
    };
  });
  const passed = r.cases.filter((c) => c.verdict === "AC" || c.verdict === "PASS").length;
  const stderr = r.verdict === "CE" ? (r.compile?.stderr ?? r.stderr) : r.stderr;
  return {
    verdict: r.verdict,
    duration_ms: Math.round(r.duration_ms),
    passed,
    total: r.cases.length,
    cases,
    stdout_head: head(r.stdout, 2048),
    stderr_head: head(stderr, 2048),
  };
}

function expectOk(expect: string, verdict: string): boolean {
  if (expect === "any") return true;
  if (expect === "AC" || expect === "PASS") return verdict === "AC" || verdict === "PASS";
  return verdict === expect;
}

function zodPath(p: PropertyKey[]): string {
  return p.map((k, i) => (typeof k === "number" ? `[${k}]` : `${i ? "." : ""}${String(k)}`)).join("");
}

function finish(report: ValidationReport): ValidationReport {
  report.errors = report.errors.slice(0, MAX_ERRORS);
  report.warnings = report.warnings.slice(0, MAX_WARNINGS);
  report.ok = report.errors.length === 0;
  if (report.ok) report.stage = "done";
  return report;
}

export async function validateDemoDraft(input: ValidateInput, opts: ValidateOptions): Promise<{ report: ValidationReport; validated?: ValidatedDemo }> {
  const env = opts.env ?? process.env;
  const report: ValidationReport = { ok: false, stage: "P0", errors: [], warnings: [] };
  const done = () => ({ report: finish(report) });

  // ---- P0 入口 ----
  const bytes = Buffer.byteLength(JSON.stringify(input.draft ?? null), "utf8");
  if (bytes > LIMITS.scriptBytes) {
    report.errors.push({ code: "E_TOO_LARGE", message: `台本が ${Math.round(bytes / 1024)} KB あります（上限 ${LIMITS.scriptBytes / 1024} KB）`, hint: "ステップを減らすか、write ではなく replace を使ってください" });
    return done();
  }
  const busy = await activeRecordings(opts.dataRoot);
  if (busy.length) {
    report.errors.push(busyIssue(busy));
    return done();
  }
  const problem = await findProblemById(opts.problemsRoot, input.problem_id);
  if (!problem) {
    report.errors.push({ code: "E_UNKNOWN_PROBLEM", message: `問題が見つかりません: ${input.problem_id}`, hint: "list_problems で id を確認してください（例: alg-0001）" });
    return done();
  }
  const unsupported = unsupportedReason(problem);
  if (unsupported) {
    report.errors.push({ code: "E_JUDGE_UNSUPPORTED", message: unsupported });
    return done();
  }
  const lang = Language.safeParse(input.language);
  if (!lang.success || !problem.meta.languages.includes(lang.data)) {
    report.errors.push({ code: "E_LANGUAGE", message: `${input.problem_id} は ${input.language} に対応していません`, hint: `対応言語: ${problem.meta.languages.join(", ")}` });
    return done();
  }
  const language = lang.data;
  if (problem.tests.kind === "unit" && !problem.tests.userEntry[language]) {
    report.errors.push({ code: "E_LANGUAGE", message: `${input.problem_id} には ${language} のテストハーネスがありません` });
    return done();
  }

  // ---- P1 スキーマ ----
  report.stage = "P1";
  const parsed = DemoDraft.safeParse(input.draft);
  if (!parsed.success) {
    const raw = input.draft as { steps?: { id?: unknown }[] } | null;
    for (const iss of parsed.error.issues.slice(0, MAX_ERRORS)) {
      const p = zodPath(iss.path);
      const si = iss.path[0] === "steps" && typeof iss.path[1] === "number" ? raw?.steps?.[iss.path[1]]?.id : undefined;
      report.errors.push({ code: "E_SCHEMA", path: p || "(root)", step_id: typeof si === "string" ? si : undefined, message: iss.message, hint: "スキーマはオーサリングガイド（lci://guides/demo-authoring）の「台本の形」を参照してください" });
    }
    return done();
  }
  const draft = parsed.data;
  const file = demoFileFor(problem, language);
  const digest = draftDigest(problem.meta.id, language, file.content, draft);
  report.digest = digest;
  const judgeKind = problem.tests.kind as "stdio" | "unit";
  const ctx = { meta: problem.meta, body: problem.body, judgeKind };

  // ---- P2 参照整合・章の構成 ----
  report.stage = "P2";
  const st = checkStructure(draft, ctx);
  report.warnings.push(...st.warnings);
  if (st.errors.length) {
    report.errors.push(...st.errors);
    return done();
  }

  // ---- P3 操作適用 ----
  report.stage = "P3";
  const first = compileDraft({ draft, initial: file.content, file: { path: file.path, language }, readingCps: opts.readingCps });
  for (const e of first.opErrors) report.errors.push({ code: e.code, step_id: e.step_id, path: e.path, message: e.message, hint: e.hint, context: e.context });
  for (const h of first.highlightErrors) {
    report.errors.push({
      code: "E_HIGHLIGHT_NOT_FOUND",
      step_id: h.step_id,
      path: h.path,
      message: h.count === 0 ? "highlight.find がステップ終了時点のコードに見つかりません" : `highlight.find が ${h.count} 箇所に一致しました（一意にしてください）`,
      hint: "highlight.find はそのステップの操作を当てた後のコードから、一意に一致する部分をそのままコピーしてください",
    });
  }
  const finalBytes = Buffer.byteLength(first.final, "utf8");
  if (finalBytes > LIMITS.fileBytes) report.errors.push({ code: "E_FILE_TOO_LARGE", message: `最終コードが ${Math.round(finalBytes / 1024)} KB あります（上限 ${LIMITS.fileBytes / 1024} KB）` });
  if (report.errors.length) return done();

  // ---- P4 実行（Docker サンドボックス。fake は LCI_DEMO_ALLOW_FAKE=1 のときだけ） ----
  report.stage = "P4";
  const runner = opts.runner ?? getRunner();
  report.runner_backend = runner.backend;
  if (runner.backend === "fake" && env.LCI_DEMO_ALLOW_FAKE !== "1") {
    report.errors.push({
      code: "E_UNSAFE_BACKEND",
      message: "LCI_RUNNER=fake（隔離なしでホスト上で実行）ではデモを検証しません（D9）。Claude が書いたコードは Docker のサンドボックスでだけ実行します",
      hint: "LCI_RUNNER を外して Docker を起動してください（テストのときだけ LCI_DEMO_ALLOW_FAKE=1 で許可）",
    });
    return done();
  }
  if (runner.backend === "docker") {
    const status = await runner.status();
    if (status.docker !== "ok") {
      report.errors.push({
        code: "E_INFRA",
        message: status.docker === "missing" ? "docker コマンドが見つかりません。テストを実行できないため保存しません" : "Docker が起動していません。テストを実行できないため保存しません",
        hint: "Docker Desktop（または OrbStack）を起動してから、もう一度 validate / save してください（D9。これは台本の問題ではありません）",
      });
      return done();
    }
    const img = status.images.find((i) => i.lang === (language === "typescript" ? "typescript" : language));
    if (img && !img.present) {
      report.errors.push({ code: "E_INFRA", message: `ランナーのイメージ ${img.image} がありません`, hint: "アプリの「ランナーを準備」または `pnpm runner:warm` を実行してから、もう一度呼んでください（台本の問題ではありません）" });
      return done();
    }
  }
  const samples = new Map((await sampleCases(opts.problemsRoot, problem)).map((c) => [c.name, c.stdin]));
  const files = (text: string) => [{ path: file.path, content: text }];
  const cache = new Map<string, RunSnapshot>();
  const runs: Record<string, RunSnapshot> = {};
  report.runs = {};
  let infra = false;
  for (const p of first.compiled.steps) {
    const step = draft.steps.find((s) => s.id === p.id)!;
    if (!step.run) continue;
    // keyframe はステップ開始時点。実行はステップの操作を当てた後のコードで行う
    const after = stepAfter(first, step.id);
    const key = `${step.run.mode}|${sha256(after)}|${step.run.stdin ?? ""}|${step.run.expect_output ?? ""}`;
    let snap = cache.get(key);
    if (!snap) {
      let r: RunResult;
      if (step.run.mode === "stdin") {
        r = await runner.run({ language, files: files(after), entry: file.path, stdin: step.run.stdin ?? "" });
        if (r.verdict === "AC" && step.run.expect_output !== undefined) {
          const cmp = compareOutput(r.stdout ?? "", step.run.expect_output, { mode: "token" });
          if (!cmp.ok) {
            r = { ...r, verdict: "WA", cases: r.cases.map((c) => ({ ...c, verdict: "WA" as const, message: cmp.message })) };
          }
        }
        // stdin 実行の 1 ケースは入力と出力を見せる（自作の境界値なのでネタバレではない）
        r = { ...r, cases: r.cases.map((c) => ({ ...c, visibility: "sample" as const, stdout: r.stdout, expected: step.run?.expect_output })) };
        samples.set("run", step.run.stdin ?? "");
      } else {
        r = await runner.judge(problem, { language, files: files(after), problemsRoot: opts.problemsRoot, visibility: step.run.mode === "sample" ? "sample" : "all" });
      }
      snap = snapshotOf(r, samples);
      cache.set(key, snap);
    }
    runs[step.id] = snap;
    const ok = expectOk(step.run.expect, snap.verdict);
    report.runs[step.id] = { mode: step.run.mode, expect: step.run.expect, verdict: snap.verdict, passed: snap.passed, total: snap.total, ok, stdout_head: head(snap.stdout_head, 200) };
    if (snap.verdict === "IE") {
      infra = true;
      report.errors.push({ code: "E_INFRA", step_id: step.id, message: `実行基盤のエラー: ${head(snap.stderr_head, 300) ?? "不明"}`, hint: "Docker / ランナー側の問題で、台本の問題ではありません。Docker を起動・ランナーを準備してから再度呼んでください" });
      break;
    }
    if (!ok) {
      const failed = snap.cases.filter((c) => c.verdict !== "AC" && c.verdict !== "PASS");
      const detail = step.run.mode === "stdin"
        ? `出力「${head(snap.stdout_head, 120) ?? ""}」${step.run.expect_output !== undefined ? `（予告: 「${step.run.expect_output}」）` : ""}`
        : failed.slice(0, 3).map((c) => `${c.name}: ${c.verdict}${c.message ? `（${c.message}）` : ""}${c.stdout_head !== undefined ? ` 出力「${head(c.stdout_head, 60)}」` : ""}`).join(" / ");
      report.errors.push({
        code: "E_RUN_EXPECT",
        step_id: step.id,
        path: `steps[${draft.steps.indexOf(step)}].run`,
        message: `このステップの実行結果が ${snap.verdict}（${snap.passed}/${snap.total}）で、expect=${step.run.expect} と合いません。${detail}${snap.verdict === "CE" || snap.verdict === "RE" ? ` ${head(snap.stderr_head, 300) ?? ""}` : ""}`,
        hint: step.run.expect === "AC"
          ? "このステップ時点のコードを直してください。意図的に失敗を見せる（寄り道）なら expect にその verdict（WA など）を書いてください"
          : "意図した失敗になっていません。失敗させたい内容とコードを見直すか、expect を実際の結果に合わせてください",
        context: { before_numbered: numberLines(after) },
      });
    }
  }
  let finalSnap: RunSnapshot | undefined;
  if (!infra) {
    const fr = await runner.judge(problem, { language, files: files(first.final), problemsRoot: opts.problemsRoot, visibility: "all" });
    finalSnap = snapshotOf(fr, samples);
    const failed = fr.cases.filter((c) => c.verdict !== "AC" && c.verdict !== "PASS");
    report.judge = { verdict: fr.verdict, passed: finalSnap.passed, total: finalSnap.total, failed: failed.map((c) => ({ name: c.name, verdict: c.verdict, message: head(c.message, 200) })) };
    if (fr.verdict === "IE") {
      report.errors.push({ code: "E_INFRA", message: `最終判定で実行基盤のエラー: ${head(fr.stderr, 300) ?? "不明"}`, hint: "Docker / ランナー側の問題で、台本の問題ではありません" });
    } else if (fr.verdict !== "AC") {
      const lines = failed.slice(0, 4).map((c) => `${c.name}（${c.visibility}）: ${c.verdict}${c.message ? ` ${head(c.message, 120)}` : ""}`);
      report.errors.push({
        code: "E_FINAL_JUDGE",
        message: `最終コードが全ケースに通りません: ${fr.verdict} ${finalSnap.passed}/${finalSnap.total}。${lines.join(" / ")}${fr.verdict === "CE" ? ` ${head(fr.compile?.stderr, 300) ?? ""}` : ""}`,
        hint: failed.some((c) => c.verdict === "TLE") ? "大きいケースで時間切れです。計算量（二重ループになっていないか）を見直してください" : "最終コードは hidden も含めて全ケースに通る必要があります（D8）。参照解と比べて境界の扱いを確認してください",
        context: { before_numbered: numberedWindows(first.final, []) },
      });
    }
  }

  // ---- P5〜P8（実測の実行時間で組み直す） ----
  const out = compileDraft({ draft, initial: file.content, file: { path: file.path, language }, runs, readingCps: opts.readingCps });
  report.stage = "P5";
  const tm = checkTiming(draft, out.compiled, out.timings, ctx);
  report.errors.push(...tm.errors);
  report.warnings.push(...tm.warnings);
  report.stage = "P6";
  const { metrics, self } = demoMetrics(out.compiled, problem.meta, out.timings);
  report.self_metrics = self;
  const sm = checkSelfMetrics(draft, metrics);
  report.errors.push(...sm.errors);
  report.warnings.push(...sm.warnings);
  report.stage = "P7";
  const cov = checkCoverage(draft, out.compiled.narration.segments, ctx);
  report.errors.push(...cov.errors);
  report.warnings.push(...cov.warnings);
  report.coverage = cov.coverage;
  report.stage = "P8";
  const ln = lintNarration(draft);
  report.errors.push(...ln.errors);
  report.warnings.push(...ln.warnings);
  report.warnings.push(...checkSymbols(draft, out.compiled, stepTexts(out), ctx));

  report.estimate = estimateOf(out.compiled.duration, out.timings, problem.meta.time_limit);
  const finalSha = sha256(out.final);
  report.final = { sha256: finalSha, code_numbered: numberLines(out.final) };
  finish(report);
  if (!report.ok || !finalSnap) return { report };
  return {
    report,
    validated: {
      problem,
      language,
      file: { path: file.path, base: file.base, base_sha256: sha256(file.content), base_text: file.content },
      draft,
      runs,
      final_judge: finalSnap,
      final_sha256: finalSha,
      final_text: out.final,
      estimate_ms: out.compiled.duration,
      self_metrics: self,
      digest,
      runner_backend: runner.backend,
      warnings: report.warnings,
    },
  };
}

function stepTexts(out: ReturnType<typeof compileDraft>): Map<string, { before: string; after: string }> {
  const m = new Map<string, { before: string; after: string }>();
  const ids = out.compiled.steps.map((s) => s.id);
  ids.forEach((id, i) => {
    const before = out.compiled.keyframes[`kf:${id}`] ?? "";
    const next = ids[i + 1];
    const after = next ? (out.compiled.keyframes[`kf:${next}`] ?? "") : out.final;
    m.set(id, { before, after });
  });
  return m;
}

function stepAfter(out: ReturnType<typeof compileDraft>, id: string): string {
  return stepTexts(out).get(id)?.after ?? out.final;
}

function estimateOf(durationMs: number, timings: StepTimingReport[], timeLimitMin: number): NonNullable<ValidationReport["estimate"]> {
  const s = (ms: number) => Math.round(ms / 100) / 10;
  return {
    duration_s: s(durationMs),
    timing_source: "estimated",
    time_limit_s: timeLimitMin * 60,
    ratio_of_limit: Math.round((durationMs / (timeLimitMin * 60_000)) * 100) / 100,
    steps: timings.map((t) => ({ id: t.id, chapter: t.chapter, t0_s: s(t.t0), say_s: s(t.say_ms), typing_s: s(t.typing_ms), cps: t.cps, silent_typing_s: s(t.silent_typing_ms) })),
  };
}

/** DemoScript.validation.warnings 用（文字列 50 件まで） */
export function warningStrings(ws: DemoIssue[]): string[] {
  return ws.slice(0, 50).map((w) => `${w.code}${w.step_id ? ` [${w.step_id}]` : ""}: ${w.message}`.slice(0, 500));
}
