import { test } from "node:test";
import assert from "node:assert/strict";
import { inferTechniques } from "./techniques.ts";
import { buildWebRunResult } from "./judge.ts";
import type { RequestRecord, ScenarioResult } from "./protocol.ts";

function sr(partial: Partial<ScenarioResult> & { name: string }): ScenarioResult {
  return { verdict: "PASS", steps: [], layout: [], requests: [], clicks: [], typed: [], errors: [], duration_ms: 0, ...partial };
}
function req(id: number, t: number, status: RequestRecord["status"], q = "lorem"): RequestRecord {
  return { id, t, url: `https://api.example.com/search?q=${q}`, method: "GET", status };
}

test("empty-skip: 空入力でクリックしてもリクエスト 0", () => {
  assert.deepEqual(inferTechniques([sr({ name: "empty", typed: [""], clicks: [100] })]), ["empty-skip"]);
  assert.deepEqual(inferTechniques([sr({ name: "empty", typed: [""], clicks: [100], requests: [req(1, 101, "completed", "")] })]), []);
});

test("abort: aborted なリクエストがあれば検出", () => {
  const r = sr({ name: "rapid", typed: ["lorem"], clicks: [0, 50, 100], requests: [req(1, 1, "aborted"), req(2, 51, "aborted"), req(3, 101, "completed")] });
  assert.deepEqual(inferTechniques([r]), ["abort"]);
});

test("dedupe: 同じクエリ 2 回で 1 リクエスト、最初のクリック直後に出ている", () => {
  const r = sr({ name: "cached", typed: ["sit"], clicks: [0, 1300], requests: [req(1, 2, "completed", "sit")] });
  assert.deepEqual(inferTechniques([r]), ["dedupe"]);
});

test("debounce: 連打の最後より後に 1 回だけ出ている", () => {
  const r = sr({ name: "rapid", typed: ["lorem"], clicks: [0, 50, 100, 150, 200], requests: [req(1, 520, "completed")] });
  assert.deepEqual(inferTechniques([r]), ["debounce"]);
});

test("素朴実装（クリック回数ぶんリクエスト）は何も検出しない", () => {
  const r = sr({ name: "rapid", typed: ["lorem"], clicks: [0, 50], requests: [req(1, 1, "completed"), req(2, 51, "completed")] });
  assert.deepEqual(inferTechniques([r]), []);
});

test("buildWebRunResult: 全 PASS で verdict PASS、t はオフセット加算、TLE はメッセージから", () => {
  const run = buildWebRunResult({
    runId: "web-1",
    language: "html",
    startedAtWall: "2026-10-24T10:00:00.000Z",
    t: 5000,
    durationMs: 1234,
    results: [
      { result: sr({ name: "a", requests: [req(1, 100, "completed")] }), tOffset: 1000 },
      { result: sr({ name: "b", verdict: "FAIL", steps: [{ index: 2, step: { wait: 1 }, ok: false, message: "ステップがタイムアウト（15000ms）" }] }), tOffset: 0 },
    ],
  });
  assert.equal(run.verdict, "FAIL");
  assert.equal(run.cases[0]!.verdict, "PASS");
  assert.equal(run.cases[1]!.verdict, "TLE");
  assert.match(run.cases[1]!.message ?? "", /step 3/);
  assert.equal(run.behavior?.requests[0]?.t, 1100);
  assert.equal(run.infra.backend, "iframe");
  assert.equal(run.mode, "judge");
  const ok = buildWebRunResult({ runId: "w", language: "html", startedAtWall: "x", t: 0, durationMs: 0, results: [{ result: sr({ name: "a" }), tOffset: 0 }] });
  assert.equal(ok.verdict, "PASS");
});
