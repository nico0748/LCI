import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProblemDir } from "@lci/core";
import { scaffoldProblem, nextId } from "./scaffold.ts";
import { validateProblems } from "./gates.ts";
import { catalogDir, problemsRoot } from "./paths.ts";

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

/** 本物の種表（seeds.json / targets.json）だけを持つ空の問題バンク */
async function rootWithCatalog(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lci-scaffold-cp-"));
  await fs.mkdir(path.join(root, "_catalog"));
  for (const f of ["seeds.json", "targets.json"]) await fs.copyFile(path.join(catalogDir(problemsRoot()), f), path.join(root, "_catalog", f));
  return root;
}

function hasPython(): boolean {
  return spawnSync("python3", ["--version"]).status === 0;
}

test("new CP --id: 種の固定枠から slug・難易度・時間・style を取り、6 言語の CP 雛形を作る", async () => {
  const root = await rootWithCatalog();
  const made = await scaffoldProblem(root, "CP", undefined, { id: "cp-0003" });
  assert.equal(path.relative(root, made.dir), path.join("CP", "cp-0003-bookshelf-min-width"));
  const p = await loadProblemDir(root, path.relative(root, made.dir));
  assert.equal(p.meta.category, "CP");
  assert.equal(p.meta.title, "本棚 K 段の最小の棚幅");
  assert.equal(p.meta.difficulty, "L3");
  assert.equal(p.meta.time_limit, 30);
  assert.deepEqual(p.meta.tags.company_style, ["atcoder"]);
  assert.deepEqual(p.meta.languages, ["c", "rust", "python", "go", "typescript", "php"]);
  assert.equal(p.meta.talking_points.length, 5);
  // starter は言語ごとに 1 つ、runner の既定ファイル名で（Run/判定の entry 推定がそのまま当たる）
  assert.deepEqual(
    p.meta.starter_files.map((f) => [f.language, f.path]),
    [["c", "main.c"], ["rust", "main.rs"], ["python", "main.py"], ["go", "main.go"], ["typescript", "main.ts"], ["php", "main.php"]],
  );
  assert.ok(p.meta.starter_files.every((f) => (f.content ?? "").includes("TODO")));
  assert.equal(p.tests.kind, "stdio");
  for (const f of ["gen/gen.py", "gen/brute.py", "solutions/rust/main.rs", "starter/go/main.go"]) await fs.access(path.join(made.dir, f));

  // 構造系のゲートは雛形の時点で通る（CP ゲートは hidden 不足などで落ちてよい）
  const r = await validateProblems(root);
  assert.deepEqual(r.entries.flatMap((e) => e.issues).filter((i) => i.level === "error" && ["G1", "G1b", "TESTS"].includes(i.gate)), []);
  assert.ok(r.entries.flatMap((e) => e.issues).some((i) => i.gate === "CP" && /hidden が 0 件/.test(i.message)));

  // id 指定は採番より優先され、同じ id は slug が違っても作れない
  await assert.rejects(() => scaffoldProblem(root, "CP", "other-slug", { id: "cp-0003" }), /既にある|固定/);
  // 種表で slug が決まっている枠に別の slug は付けられない
  await assert.rejects(() => scaffoldProblem(root, "CP", "my-own", { id: "cp-0004" }), /banned-word-mask/);
  // id の形式とカテゴリの一致
  await assert.rejects(() => scaffoldProblem(root, "CP", "x", { id: "cp-12" }), /形式/);
  await assert.rejects(() => scaffoldProblem(root, "CP", "x", { id: "alg-0001" }), /形式/);
  // slug の無い種（cp-0041 以降）では slug が必要
  await assert.rejects(() => scaffoldProblem(root, "CP", undefined, { id: "cp-0041" }), /slug が必要/);
  const free = await scaffoldProblem(root, "CP", "my-topic", { id: "cp-0041" });
  assert.equal(path.basename(free.dir), "cp-0041-my-topic");
  // 採番は従来どおり最大値 + 1
  assert.equal(await nextId(root, "CP"), "cp-0042");
});

test("new CP: gen/gen.py の骨組みは決定的で、--check が改変・古いファイル・brute との不一致を検出する", async (t) => {
  if (!hasPython()) return t.skip("python3 がありません");
  const root = await rootWithCatalog();
  const { dir } = await scaffoldProblem(root, "CP", undefined, { id: "cp-0039" });
  const gen = path.join(dir, "gen", "gen.py");
  assert.equal(spawnSync("python3", ["-m", "py_compile", gen]).status, 0);
  // 問題ごとに書く 3 か所を、和を出すだけの問題で埋める
  let src = await fs.readFile(gen, "utf8");
  src = src
    .replace(/def solve\(inp: str\) -> str:\n(?:    .*\n)+/, 'def solve(inp: str) -> str:\n    xs = list(map(int, inp.split()))\n    return f"{sum(xs[1:])}\\n"\n')
    .replace(/def random_small\(rng: SplitMix64\) -> str:\n(?:    .*\n)+/, 'def random_small(rng: SplitMix64) -> str:\n    n = rng.randint(1, 5)\n    return f"{n}\\n" + " ".join(str(rng.randint(-9, 9)) for _ in range(n)) + "\\n"\n')
    .replace('out.append(("sample-1", "sample", "TODO\\n"))', 'out.append(("sample-1", "sample", "2\\n1 2\\n"))')
    .replace('out.append(("sample-2", "sample", "TODO\\n"))', 'out.append(("sample-2", "sample", "1\\n5\\n"))')
    .replace("    return out\n", '    for i in range(3):\n        out.append((f"hidden-rand-{i + 1}", "hidden", random_small(rng)))\n    return out\n');
  await fs.writeFile(gen, src);
  await fs.writeFile(path.join(dir, "gen", "brute.py"), "def brute(inp: str) -> str:\n    xs = inp.split()\n    s = 0\n    for x in xs[1:]:\n        s += int(x)\n    return f'{s}\\n'\n");
  const run = (...a: string[]) => spawnSync("python3", [gen, ...a], { encoding: "utf8" });
  // 生成 → check は一致。2 回生成しても同じ（決定的）
  assert.equal(run().status, 0, run().stderr);
  const first = await fs.readFile(path.join(dir, "tests", "13.in"), "utf8");
  assert.equal(run().status, 0);
  assert.equal(await fs.readFile(path.join(dir, "tests", "13.in"), "utf8"), first);
  const ok = run("--check");
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const tj = JSON.parse(await fs.readFile(path.join(dir, "tests.json"), "utf8"));
  assert.deepEqual(tj.cases.map((c: { name: string; stdinFile: string }) => [c.name, c.stdinFile]), [
    ["sample-1", "tests/01.in"],
    ["sample-2", "tests/02.in"],
    ["hidden-rand-1", "tests/11.in"],
    ["hidden-rand-2", "tests/12.in"],
    ["hidden-rand-3", "tests/13.in"],
  ]);
  assert.equal(tj.limits.timeMs, 2000); // 手で書いた部分は残る
  // 期待出力を手で書き換えると不一致、古いファイルも検出
  await fs.writeFile(path.join(dir, "tests", "01.out"), "999\n");
  await fs.writeFile(path.join(dir, "tests", "99.in"), "stale\n");
  const ng = run("--check");
  assert.equal(ng.status, 1);
  assert.match(ng.stdout, /tests\/01\.out が再生成と一致しない/);
  assert.match(ng.stdout, /tests\/99\.in は生成されない古いファイル/);
  // 書き込みモードは古いファイルを消して一致に戻す
  assert.equal(run().status, 0);
  assert.equal(run("--check").status, 0);
  // brute と食い違えば stress が落ちる
  await fs.writeFile(path.join(dir, "gen", "brute.py"), "def brute(inp: str) -> str:\n    return '0\\n'\n");
  const st = run("--check");
  assert.equal(st.status, 1);
  assert.match(st.stdout, /solve と brute が不一致/);
});
