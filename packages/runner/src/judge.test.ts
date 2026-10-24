import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs, constants as fsc } from "node:fs";
import path from "node:path";
import { loadProblemDir, RunResult, type Problem } from "@lci/core";
import { FakeBackend } from "./backend-fake.ts";
import { judgeProblem, runOnce, worstVerdict } from "./judge.ts";
import { createRunner } from "./runner.ts";
import type { RunnerLanguage, SourceFile } from "./types.ts";

/**
 * FakeBackend（ホストのツールチェーンを直接使う）で judge ロジックを検証する。
 * docker が無い環境でも動くことが目的。ツールが無い言語は skip する。
 */

const ROOT = path.resolve(import.meta.dirname, "../../../problems");
const backend = new FakeBackend();

async function has(bin: string): Promise<boolean> {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    try {
      await fs.access(path.join(dir, bin), fsc.X_OK);
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}
const TOOL: Record<RunnerLanguage, string> = { c: "gcc", rust: "rustc", python: "python3", go: "go", typescript: "node", php: "php" };

async function solutionFiles(p: Problem, lang: RunnerLanguage): Promise<SourceFile[]> {
  const rel = p.meta.reference_solutions[lang];
  assert.ok(rel, `${p.meta.id} に ${lang} の参照解がありません`);
  const content = await fs.readFile(path.join(ROOT, p.dir, rel), "utf8");
  return [{ path: path.posix.basename(rel), content }];
}

test("ALG problems load via loadProblemDir", async () => {
  const a = await loadProblemDir(ROOT, "ALG/alg-0001-two-sum");
  assert.equal(a.meta.id, "alg-0001");
  assert.equal(a.tests.kind, "stdio");
  assert.ok(a.meta.talking_points.length >= 3);
  assert.ok(a.meta.requirements.length >= 3);
  assert.ok(a.body.statement.includes("A_i + A_j = K"));
  assert.ok(a.body.interviewer_notes.length > 0 && a.body.review_notes.length > 0);
  if (a.tests.kind === "stdio") {
    assert.ok(a.tests.cases.some((c) => c.visibility === "sample"));
    assert.ok(a.tests.cases.some((c) => c.visibility === "hidden"));
    assert.equal(a.tests.stopOn.consecutiveTle, 2);
  }
  // 「languages は参照解とテストが実在する言語のみ」（CLAUDE.md）
  for (const l of a.meta.languages) assert.ok(a.meta.reference_solutions[l], l);

  const b = await loadProblemDir(ROOT, "ALG/alg-0002-lru-cache");
  assert.equal(b.meta.id, "alg-0002");
  assert.equal(b.tests.kind, "unit");
  if (b.tests.kind === "unit") {
    for (const l of b.meta.languages) {
      assert.ok(b.tests.harness[l], `harness ${l}`);
      assert.ok(b.tests.userEntry[l], `userEntry ${l}`);
      assert.ok(b.meta.reference_solutions[l], `solution ${l}`);
    }
  }
  assert.ok(b.meta.starter_files.every((f) => f.content && f.content.length > 0));
});

for (const lang of ["python", "typescript", "c", "go", "rust", "php"] as const) {
  test(`alg-0001 reference solution is AC (${lang}, fake backend)`, async (t) => {
    if (!(await has(TOOL[lang]))) return t.skip(`${TOOL[lang]} がありません`);
    const p = await loadProblemDir(ROOT, "ALG/alg-0001-two-sum");
    const r = await judgeProblem(backend, p, { language: lang, files: await solutionFiles(p, lang), problemsRoot: ROOT, t: 1234 });
    RunResult.parse(r);
    assert.equal(r.verdict, "AC", JSON.stringify({ compile: r.compile, stderr: r.stderr, cases: r.cases.filter((c) => c.verdict !== "AC") }, null, 1));
    assert.equal(r.mode, "judge");
    assert.equal(r.t, 1234);
    assert.equal(r.cases.length, 8);
  });
}

for (const lang of ["python", "typescript", "go"] as const) {
  test(`alg-0002 reference solution passes unit harness (${lang}, fake backend)`, async (t) => {
    if (!(await has(TOOL[lang]))) return t.skip(`${TOOL[lang]} がありません`);
    const p = await loadProblemDir(ROOT, "ALG/alg-0002-lru-cache");
    const r = await judgeProblem(backend, p, { language: lang, files: await solutionFiles(p, lang), problemsRoot: ROOT });
    RunResult.parse(r);
    assert.equal(r.verdict, "AC", JSON.stringify({ stderr: r.stderr, stdout: r.stdout?.slice(0, 2000), cases: r.cases }, null, 1));
    assert.equal(r.cases.length, 6);
    assert.ok(r.cases.every((c) => c.verdict === "PASS"));
  });

  test(`alg-0002 starter fails with per-test FAIL (${lang})`, async (t) => {
    if (!(await has(TOOL[lang]))) return t.skip(`${TOOL[lang]} がありません`);
    const p = await loadProblemDir(ROOT, "ALG/alg-0002-lru-cache");
    const starter = p.meta.starter_files.find((f) => f.language === lang)!;
    const r = await judgeProblem(backend, p, { language: lang, files: [{ path: starter.path, content: starter.content! }], problemsRoot: ROOT });
    assert.equal(r.verdict, "WA", JSON.stringify(r, null, 1).slice(0, 3000));
    // get が常に -1 なので「missing」だけ通る
    assert.deepEqual(r.cases.filter((c) => c.verdict === "PASS").length, 1);
    assert.ok(r.cases.some((c) => c.verdict === "FAIL" && c.message));
  });
}

test("stdio: WA with first-diff message, sample-only visibility", async (t) => {
  if (!(await has("python3"))) return t.skip("python3 がありません");
  const p = await loadProblemDir(ROOT, "ALG/alg-0001-two-sum");
  const r = await judgeProblem(backend, p, { language: "python", files: [{ path: "main.py", content: "print('1 2')\n" }], problemsRoot: ROOT, visibility: "sample" });
  assert.equal(r.verdict, "WA");
  assert.equal(r.cases.length, 3);
  assert.equal(r.cases[0]?.verdict, "AC");
  assert.equal(r.cases[1]?.verdict, "WA");
  assert.match(r.cases[1]!.message!, /期待 "2"/);
});

test("stdio: consecutive TLE stops early (stopOn.consecutiveTle=2)", async (t) => {
  if (!(await has("python3"))) return t.skip("python3 がありません");
  const p = await loadProblemDir(ROOT, "ALG/alg-0001-two-sum");
  // 制限を短くした複製で時間を節約する（python は ×3 → 300ms）
  const fast: Problem = structuredClone(p);
  if (fast.tests.kind !== "stdio") throw new Error("unreachable");
  fast.tests.limits = { timeMs: 100, wallMs: 100, outputKb: 64 };
  const r = await judgeProblem(backend, fast, { language: "python", files: [{ path: "main.py", content: "while True:\n    pass\n" }], problemsRoot: ROOT });
  assert.equal(r.verdict, "TLE");
  assert.equal(r.cases.length, 2);
  assert.ok(r.cases.every((c) => c.verdict === "TLE"));
  assert.match(r.stderr ?? "", /TLE が 2 回連続/);
});

test("run: CE for C with diagnostics", async (t) => {
  if (!(await has("gcc"))) return t.skip("gcc がありません");
  const r = await runOnce(backend, { language: "c", files: [{ path: "main.c", content: "int main(void){ return y; }\n" }] });
  assert.equal(r.verdict, "CE");
  assert.equal(r.compile?.ok, false);
  const d = r.compile!.diagnostics.find((x) => x.severity === "error");
  assert.equal(d?.file, "main.c");
  assert.equal(d?.line, 1);
});

test("run: CE for Rust via --error-format=json", async (t) => {
  if (!(await has("rustc"))) return t.skip("rustc がありません");
  const r = await runOnce(backend, { language: "rust", files: [{ path: "main.rs", content: 'fn main() { let x: i32 = "a"; }\n' }] });
  assert.equal(r.verdict, "CE");
  assert.deepEqual(r.compile?.diagnostics[0], { file: "main.rs", line: 1, col: 26, severity: "error", message: "[E0308] mismatched types" });
  assert.match(r.compile!.stderr, /error\[E0308\]/); // rendered テキストを UI 用に残す
});

test("run: CE for PHP via php -l", async (t) => {
  if (!(await has("php"))) return t.skip("php がありません");
  const r = await runOnce(backend, { language: "php", files: [{ path: "main.php", content: '<?php\necho "a"\necho "b";\n' }] });
  assert.equal(r.verdict, "CE");
  assert.equal(r.compile?.diagnostics[0]?.line, 3);
});

test("run: stdin piped, RE with runtime diagnostic, TLE, OLE (python)", async (t) => {
  if (!(await has("python3"))) return t.skip("python3 がありません");
  const ok = await runOnce(backend, { language: "python", files: [{ path: "main.py", content: "print(input()[::-1])\n" }], stdin: "abc\n", t: 50 });
  assert.equal(ok.verdict, "AC");
  assert.equal(ok.stdout, "cba\n");
  assert.equal(ok.mode, "run");
  assert.equal(ok.t, 50);

  const re = await runOnce(backend, { language: "python", files: [{ path: "main.py", content: "def f():\n    return 1/0\nf()\n" }] });
  assert.equal(re.verdict, "RE");
  assert.equal(re.exit_code, 1);
  assert.deepEqual(re.compile?.diagnostics[0], { file: "main.py", line: 2, col: undefined, severity: "error", message: "ZeroDivisionError: division by zero" });

  const tle = await runOnce(backend, { language: "python", files: [{ path: "main.py", content: "print('start', flush=True)\nwhile True: pass\n" }], limits: { timeMs: 100, wallMs: 100 } });
  assert.equal(tle.verdict, "TLE");
  assert.equal(tle.stdout, "start\n");
  assert.match(tle.stderr ?? "", /無限ループ/);

  const ole = await runOnce(backend, { language: "python", files: [{ path: "main.py", content: "while True: print('x' * 1000)\n" }], limits: { outputKb: 16 } });
  assert.equal(ole.verdict, "OLE");
});

test("run: typescript strip-types syntax error is RE with line/col", async (t) => {
  if (!(await has("node"))) return t.skip("node がありません");
  const r = await runOnce(backend, { language: "typescript", files: [{ path: "main.ts", content: "const x: number = ;\n" }] });
  assert.equal(r.verdict, "RE");
  const d = r.compile?.diagnostics[0];
  assert.equal(d?.file, "main.ts");
  assert.equal(d?.line, 1);
  assert.equal(d?.col, 19);
});

test("run: unsupported language and bad path are IE", async () => {
  const r = await runOnce(backend, { language: "html", files: [{ path: "index.html", content: "" }] });
  assert.equal(r.verdict, "IE");
  const b = await runOnce(backend, { language: "python", files: [{ path: "../evil.py", content: "" }] });
  assert.equal(b.verdict, "IE");
});

test("runner serializes per language and keeps results independent", async (t) => {
  if (!(await has("python3"))) return t.skip("python3 がありません");
  const runner = createRunner("fake");
  const rs = await Promise.all(
    [1, 2, 3].map((i) => runner.run({ language: "python", files: [{ path: "main.py", content: `print(${i})\n` }] })),
  );
  assert.deepEqual(rs.map((r) => r.stdout), ["1\n", "2\n", "3\n"]);
  const st = await runner.status();
  assert.equal(st.backend, "fake");
});

test("worstVerdict ordering", () => {
  assert.equal(worstVerdict(["AC", "WA", "TLE"]), "TLE");
  assert.equal(worstVerdict(["AC", "AC"]), "AC");
  assert.equal(worstVerdict(["RE", "WA"]), "RE");
  assert.equal(worstVerdict([]), "AC");
});
