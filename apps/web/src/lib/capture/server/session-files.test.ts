import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllProblems } from "@lci/core";
import { DEFAULT_ENTRY, pickEntry } from "@lci/runner";
import { defaultFileName, initialSessionFiles } from "./session-files.ts";

// リポジトリの problems/（apps/web/src/lib/capture/server から 6 つ上）
const PROBLEMS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../problems");

test("既存 alg-0001 を C で始めると main.c だけを開き、判定の entry も main.py にならない", async () => {
  const p = (await loadAllProblems(PROBLEMS_ROOT)).find((x) => x.meta.id === "alg-0001");
  assert.ok(p, "problems/ALG/alg-0001-* が見つからない");
  // 前提: alg-0001 は C に対応するが C の starter は無い（main.py / main.ts）。全 starter を配っていた以前は pickEntry が main.py を選んでいた
  assert.ok(p.meta.languages.includes("c"));
  assert.ok(!p.meta.starter_files.some((f) => f.language === "c"));
  assert.equal(pickEntry("c", p.meta.starter_files), "main.py");

  const c = initialSessionFiles(p.meta.starter_files, "c");
  assert.deepEqual(c.map((f) => [f.file_id, f.path, f.language]), [["f1", "main.c", "c"]]);
  assert.equal(pickEntry("c", c), "main.c");

  const py = initialSessionFiles(p.meta.starter_files, "python");
  assert.deepEqual(py.map((f) => f.path), ["main.py"]);
  assert.equal(pickEntry("python", py), "main.py");
});

test("その言語の starter が無ければ言語既定の 1 ファイル（runner の既定名）にする", () => {
  const starters = [
    { path: "main.py", language: "python" as const },
    { path: "util.py", language: "python" as const },
    { path: "index.html", language: "html" as const },
  ];
  // 同じ言語の starter は順序を保って全部開く
  assert.deepEqual(initialSessionFiles(starters, "python").map((f) => [f.file_id, f.path]), [["f1", "main.py"], ["f2", "util.py"]]);
  assert.deepEqual(initialSessionFiles(starters, "html").map((f) => f.path), ["index.html"]);
  assert.deepEqual(initialSessionFiles(starters, "go"), [{ file_id: "f1", path: "main.go", language: "go" }]);
  assert.deepEqual(initialSessionFiles([], "sql"), [{ file_id: "f1", path: "query.sql", language: "sql" }]);
  for (const lang of ["c", "rust", "python", "go", "typescript", "php"] as const) assert.equal(defaultFileName(lang), DEFAULT_ENTRY[lang]);
  assert.equal(defaultFileName("javascript"), "main.js");
  assert.equal(defaultFileName("markdown"), "notes.md");
});
