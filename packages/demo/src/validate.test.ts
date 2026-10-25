import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRunner } from "@lci/runner";
import { SessionStore } from "@lci/core";
import { validateDemoDraft, activeRecordings, type ValidateOptions } from "./validate.ts";

const tmpDirs: string[] = [];
after(async () => {
  for (const d of tmpDirs) await fs.rm(d, { recursive: true, force: true });
});
const PROBLEMS_ROOT = path.resolve(import.meta.dirname, "../../../problems");
const FIXTURE = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/alg-0001-python.draft.json"), "utf8"));
const runner = createRunner("fake");

async function opts(env: NodeJS.ProcessEnv = { LCI_DEMO_ALLOW_FAKE: "1" }): Promise<ValidateOptions> {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lci-demo-val-"));
  tmpDirs.push(dataRoot);
  return { problemsRoot: PROBLEMS_ROOT, dataRoot, runner, env };
}

function draft(): typeof FIXTURE {
  return structuredClone(FIXTURE);
}

function stepOf(d: typeof FIXTURE, id: string) {
  return d.steps.find((s: { id: string }) => s.id === id);
}

const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

test("模範解答の台本（alg-0001 python）は検証に通る", async () => {
  const { report, validated } = await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: draft() }, await opts());
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.equal(report.runner_backend, "fake");
  assert.equal(report.judge?.verdict, "AC");
  assert.equal(report.judge?.passed, report.judge?.total);
  assert.deepEqual(codes(report.warnings), [], "target_minutes=5 を書いているので W_TOO_SHORT は出さない");
  assert.ok(validated);
  // 予告どおりの結果: 寄り道で WA → 直して AC
  assert.equal(report.runs?.["det-1"]?.verdict, "WA");
  assert.equal(report.runs?.["det-4"]?.verdict, "AC");
  assert.ok(report.estimate && report.estimate.duration_s > 180);
  assert.equal(report.self_metrics?.silent_typing_max_s, 0);
  assert.match(report.final!.code_numbered, /^\s*1\| import sys/m);
});

test("P0: 問題・言語・判定の種類", async () => {
  const o = await opts();
  const unknown = await validateDemoDraft({ problem_id: "zzz-9999", language: "python", draft: draft() }, o);
  assert.deepEqual(codes(unknown.report.errors), ["E_UNKNOWN_PROBLEM"]);
  assert.equal(unknown.report.stage, "P0");
  const trav = await validateDemoDraft({ problem_id: "../ALG", language: "python", draft: draft() }, o);
  assert.deepEqual(codes(trav.report.errors), ["E_UNKNOWN_PROBLEM"]);
  const web = await validateDemoDraft({ problem_id: "fe-0001", language: "html", draft: draft() }, o);
  assert.deepEqual(codes(web.report.errors), ["E_JUDGE_UNSUPPORTED"], "D7: web 問題は v1.1");
  const lang = await validateDemoDraft({ problem_id: "alg-0001", language: "html", draft: draft() }, o);
  assert.deepEqual(codes(lang.report.errors), ["E_LANGUAGE"]);
});

test("P1: スキーマ違反は path と step_id 付き", async () => {
  const d = draft();
  delete d.steps[2].chapter;
  d.steps[3].code = [{ op: "move", to: 3 }];
  const { report } = await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d }, await opts());
  assert.equal(report.ok, false);
  assert.equal(report.stage, "P1");
  assert.ok(report.errors.every((e) => e.code === "E_SCHEMA"));
  const e = report.errors.find((x) => x.path?.startsWith("steps[2]"));
  assert.ok(e, JSON.stringify(report.errors));
  assert.equal(e.step_id, d.steps[2].id);
  assert.ok(report.errors.some((x) => x.path?.startsWith("steps[3].code[0]")));
});

test("P3: replace の old が見つからない・一意でない → その時点のコード（行番号付き）と直し方", async () => {
  const d = draft();
  stepOf(d, "impl-1").code[0].old = "     print(-1)\n";
  const nf = (await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d }, await opts())).report;
  assert.equal(nf.stage, "P3");
  const e = nf.errors[0]!;
  assert.equal(e.code, "E_OP_NOT_FOUND");
  assert.equal(e.step_id, "impl-1");
  assert.ok(e.hint && /空白|インデント/.test(e.hint), e.hint);
  const ctx = (e.context as { before_numbered: string }).before_numbered;
  assert.match(ctx, /^\s*\d+\| {5}print\(-1\)$/m, "直前のコードを行番号付きで返す");

  const d2 = draft();
  stepOf(d2, "plan-4").code = [{ op: "replace", old: "\n", new: "\n\n" }];
  const am = (await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d2 }, await opts())).report;
  assert.equal(am.errors[0]!.code, "E_OP_AMBIGUOUS");

  // 行番号付きでコピーした old には、それと分かるヒント
  const d3 = draft();
  stepOf(d3, "impl-1").code[0].old = "  10|     print(-1)\n";
  const ln = (await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d3 }, await opts())).report;
  assert.match(ln.errors[0]!.hint ?? "", /行番号/);
});

test("P4: fake ランナーは LCI_DEMO_ALLOW_FAKE=1 のときだけ（D9）", async () => {
  const { report } = await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: draft() }, await opts({}));
  assert.equal(report.ok, false);
  assert.ok(codes(report.errors).includes("E_UNSAFE_BACKEND"));
});

test("P4: 予告と違う結果は E_RUN_EXPECT、最終コードが全ケースに通らなければ E_FINAL_JUDGE", async () => {
  const d = draft();
  stepOf(d, "det-1").run.expect = "AC";
  const r1 = (await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d }, await opts())).report;
  const e = r1.errors.find((x) => x.code === "E_RUN_EXPECT");
  assert.ok(e, JSON.stringify(r1.errors));
  assert.equal(e.step_id, "det-1");
  assert.match((e.context as { before_numbered: string }).before_numbered, /if k - x in seen|seen\.get\(k - x\)/, "その時点のコード");

  // 寄り道の「修正」で登録を消してしまう（どの入力でも -1 になる）
  const d2 = draft();
  stepOf(d2, "det-3").code = [{ op: "replace", old: "        seen[x] = j\n", new: "        pass\n" }];
  stepOf(d2, "det-4").run.expect = "any";
  stepOf(d2, "rev-1").run.expect = "any";
  const r2 = (await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d2 }, await opts())).report;
  assert.ok(codes(r2.errors).includes("E_FINAL_JUDGE"), JSON.stringify(r2.errors));
  assert.equal(r2.judge?.verdict, "WA");
  assert.ok((r2.judge?.failed.length ?? 0) > 0);
});

test("P8: talking_point を covers に書かなければ E_COVERAGE", async () => {
  const d = draft();
  for (const s of d.steps) s.covers = (s.covers ?? []).filter((c: string) => c !== "tp1");
  const { report } = await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: d }, await opts());
  const e = report.errors.find((x) => x.code === "E_COVERAGE");
  assert.ok(e, JSON.stringify(report.errors));
  assert.match(e.message, /tp1/);
});

test("D15: 録画中（新しい recording セッション）は検証しない。古い recording は無視する", async () => {
  const o = await opts();
  const sessions = new SessionStore(o.dataRoot);
  await sessions.create({
    schema_version: "1.0",
    session_id: "s_rec",
    status: "recording",
    problem: { id: "alg-0001", title: "t", time_limit_sec: 900, language: "python", dir: "ALG/alg-0001-two-sum" },
    started_at_wall: new Date().toISOString(),
    clock: { origin: "performance.now", unit: "ms" },
    recorders: [],
    capture_options: { camera: false, screen: false, live_stt: false },
    warnings: [],
    files: [],
    evaluations: [],
  });
  assert.deepEqual(await activeRecordings(o.dataRoot), ["s_rec"]);
  const { report } = await validateDemoDraft({ problem_id: "alg-0001", language: "python", draft: draft() }, o);
  assert.deepEqual(codes(report.errors), ["E_BUSY_RECORDING"]);

  // 落ちたまま残った recording（3 分以上更新が無い）は録画中とみなさない
  const old = new Date(Date.now() - 10 * 60_000);
  const dir = path.join(o.dataRoot, "sessions", "s_rec");
  for (const f of await fs.readdir(dir)) await fs.utimes(path.join(dir, f), old, old);
  assert.deepEqual(await activeRecordings(o.dataRoot), []);
});
