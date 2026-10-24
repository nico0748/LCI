import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProblemDir } from "@lci/core";
import { scaffoldProblem, nextId } from "./scaffold.ts";
import { validateProblems } from "./gates.ts";

test("new: 採番して各 kind の雛形を作り、スキーマ（G1/G1b/TESTS）を満たす", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-scaffold-"));
  const a = await scaffoldProblem(root, "be", "webhook-retry");
  assert.equal(a.id, "be-0001");
  const b = await scaffoldProblem(root, "BE", "second");
  assert.equal(b.id, "be-0002");
  const fe = await scaffoldProblem(root, "FE", "tag-input");
  const alg = await scaffoldProblem(root, "ALG", "merge-intervals");
  const sys = await scaffoldProblem(root, "SYS", "image-cdn");
  for (const { dir } of [a, b, fe, alg, sys]) {
    const p = await loadProblemDir(root, path.relative(root, dir));
    assert.ok(p.meta.id);
    assert.equal(p.meta.tier, "draft");
  }
  const fep = await loadProblemDir(root, path.relative(root, fe.dir));
  assert.equal(fep.tests.kind, "web");
  const algp = await loadProblemDir(root, path.relative(root, alg.dir));
  assert.equal(algp.tests.kind, "stdio");
  const sysp = await loadProblemDir(root, path.relative(root, sys.dir));
  assert.equal(sysp.tests.kind, "none");

  // 雛形は TODO だらけなので G3/G5 は落ちてよいが、構造系のゲートは通る
  const r = await validateProblems(root);
  const structural = r.entries.flatMap((e) => e.issues).filter((i) => i.level === "error" && ["G1", "G1b", "TESTS"].includes(i.gate));
  assert.deepEqual(structural, []);
  assert.equal(await nextId(root, "BE"), "be-0003");
});

test("new: 不正な slug は拒否", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-scaffold-"));
  await assert.rejects(() => scaffoldProblem(root, "BE", "Bad_Slug"));
  await assert.rejects(() => scaffoldProblem(root, "XX", "ok"));
});
