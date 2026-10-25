import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProblemSummary } from "@lci/core/browser";
import {
  EMPTY_FILTERS,
  buildRecords,
  categoryProgress,
  filterProblems,
  filtersToEntries,
  formatDelta,
  formatWhen,
  parseFilters,
  practiceSummary,
  problemState,
  recommend,
  type EvalLite,
  type SessionLite,
} from "./browse-model.ts";

const P = (id: string, category: ProblemSummary["category"], difficulty: ProblemSummary["difficulty"], extra: Partial<ProblemSummary> = {}): ProblemSummary => ({
  id,
  slug: id,
  title: `問題 ${id}`,
  category,
  tier: "core",
  difficulty,
  time_limit: 20,
  languages: ["python", "typescript"],
  tags: { company_style: [], nfr: [], security: [], talk_focus: [] },
  dir: id,
  kind: "unit",
  ...extra,
});

const scores = (n: number) =>
  ({ R1_requirements: n, R2_plan: n, R3_tradeoffs: n, R4_correctness: n, R5_testing: n, R6_time: n, R7_sync: n, R8_attitude: n }) as EvalLite["scores"];
const E = (created_at: string, overall: number): EvalLite => ({ created_at, overall, scores: scores(3), next_practice: [{ axis: "R5_testing", action: "区切りで実行" }], summary: "" });
const S = (id: string, problemId: string, at: string, evals: EvalLite[] = [], status: SessionLite["status"] = "ready"): SessionLite => ({
  session_id: id,
  status,
  started_at_wall: at,
  problem: { id: problemId, title: problemId, language: "python" },
  durationMs: 600_000,
  evaluations: evals,
  silentEditRatio: null,
});

const problems = [
  P("fe-0001", "FE", "L2", { tags: { company_style: ["pixiv"], nfr: ["cache"], security: [], talk_focus: [] } }),
  P("fe-0002", "FE", "L1", { tags: { company_style: ["pixiv"], nfr: [], security: [], talk_focus: [] } }),
  P("fe-0003", "FE", "L3"),
  P("be-0001", "BE", "L2", { tags: { company_style: ["pixiv"], nfr: [], security: [], talk_focus: [] } }),
  P("alg-0001", "ALG", "L1"),
  P("sec-0001", "SEC", "L2", { tier: "draft" }),
];

test("buildRecords: 完了したセッションだけを数え、最新の評価で要再挑戦を決める", () => {
  const sessions = [
    S("a", "fe-0001", "2026-10-24T10:00:00+09:00", [E("2026-10-24T10:40:00+09:00", 3.0)]),
    S("b", "fe-0001", "2026-10-25T10:00:00+09:00", [E("2026-10-25T10:40:00+09:00", 3.6)]),
    S("c", "be-0001", "2026-10-25T11:00:00+09:00", [], "recording"),
    S("d", "alg-0001", "2026-10-25T12:00:00+09:00", [E("2026-10-25T12:40:00+09:00", 2.8)]),
  ];
  const r = buildRecords(sessions);
  assert.equal(r.get("fe-0001")?.attempts, 2);
  assert.equal(r.get("fe-0001")?.lastOverall, 3.6);
  assert.equal(r.get("fe-0001")?.prevOverall, 3.0);
  assert.equal(r.get("fe-0001")?.bestOverall, 3.6);
  assert.equal(problemState(r.get("fe-0001")), "tried");
  assert.equal(problemState(r.get("alg-0001")), "retry");
  assert.equal(problemState(r.get("be-0001")), "untried", "記録が途中のセッションは挑戦に数えない");
});

test("recommend: 初回は fe-0001 の 1 件だけ", () => {
  const rec = recommend(problems, new Map(), []);
  assert.deepEqual(
    rec.map((r) => [r.problem.id, r.kind]),
    [["fe-0001", "first"]],
  );
});

test("recommend: 再挑戦 → 同カテゴリ未着手 → 同形式未着手 の順で、理由を付けて 3 件", () => {
  const sessions = [S("a", "fe-0001", "2026-10-24T10:00:00+09:00", [E("2026-10-24T10:40:00+09:00", 3.4)])];
  const rec = recommend(problems, buildRecords(sessions), sessions);
  assert.deepEqual(
    rec.map((r) => [r.problem.id, r.kind]),
    [
      ["fe-0001", "retry"],
      ["fe-0002", "same-category"],
      ["be-0001", "same-style"],
    ],
  );
  assert.equal(rec[0]!.reason, "再挑戦 · 前回 3.4");
  assert.ok(rec.every((r) => r.problem.tier !== "draft"));
});

test("recommend: 総合が基準以上なら再挑戦を出さない", () => {
  const sessions = [S("a", "fe-0001", "2026-10-24T10:00:00+09:00", [E("2026-10-24T10:40:00+09:00", 4.2)])];
  const rec = recommend(problems, buildRecords(sessions), sessions);
  assert.equal(rec[0]!.kind, "same-category");
  assert.equal(rec.length, 3);
});

test("filterProblems: 複数選択・状態・下書きの扱いと、skip による件数計算", () => {
  const records = buildRecords([S("a", "fe-0001", "2026-10-24T10:00:00+09:00", [E("2026-10-24T10:40:00+09:00", 3.0)])]);
  const f = { ...EMPTY_FILTERS, category: ["FE", "BE"], status: ["untried"] };
  assert.deepEqual(
    filterProblems(problems, records, f).map((p) => p.id),
    ["fe-0002", "fe-0003", "be-0001"],
  );
  // 状態の件数は状態の条件を外して数える
  assert.equal(filterProblems(problems, records, f, "status").length, 4);
  assert.equal(filterProblems(problems, records, EMPTY_FILTERS).length, 5, "下書きは既定で隠す");
  assert.equal(filterProblems(problems, records, { ...EMPTY_FILTERS, drafts: true }).length, 6);
  assert.deepEqual(
    filterProblems(problems, records, { ...EMPTY_FILTERS, q: "CACHE" }).map((p) => p.id),
    ["fe-0001"],
  );
});

test("parseFilters / filtersToEntries は往復でき、旧形式の単一値も読める", () => {
  const params = new URLSearchParams("category=FE&difficulty=L1,L2&drafts=1&q=x");
  const f = parseFilters((k) => params.get(k) ?? "");
  assert.deepEqual(f.category, ["FE"]);
  assert.deepEqual(f.difficulty, ["L1", "L2"]);
  assert.equal(f.drafts, true);
  assert.deepEqual(new URLSearchParams(filtersToEntries(f)).toString(), "q=x&category=FE&difficulty=L1%2CL2&drafts=1");
  assert.deepEqual(filtersToEntries(EMPTY_FILTERS), []);
});

test("formatDelta / formatWhen / practiceSummary / categoryProgress", () => {
  assert.equal(formatDelta(3.4, 3.0), "+0.4");
  assert.equal(formatDelta(3.0, 3.4), "−0.4");
  assert.equal(formatDelta(3.0, 3.0), "±0");
  assert.equal(formatDelta(3.0, null), null);
  const now = new Date(2026, 9, 25);
  assert.equal(formatWhen(new Date(2026, 9, 24, 1, 5).toISOString(), now), "10/24 1:05");
  assert.equal(formatWhen(new Date(2025, 0, 2, 13, 30).toISOString(), now), "2025/1/2 13:30");
  const sessions = [S("a", "fe-0001", "2026-10-24T10:00:00+09:00", [E("2026-10-24T10:40:00+09:00", 3.0)]), S("b", "fe-0002", "2026-10-24T11:00:00+09:00"), S("c", "fe-0003", "2026-10-24T12:00:00+09:00", [], "failed")];
  assert.deepEqual(practiceSummary(sessions), { count: 2, minutes: 20, evaluated: 1 });
  const fe = categoryProgress(problems, buildRecords(sessions)).find((c) => c.category === "FE");
  assert.deepEqual(fe, { category: "FE", total: 3, tried: 2 });
});
