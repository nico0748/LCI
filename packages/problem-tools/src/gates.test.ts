import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fencedBlocks, validateProblems, type Issue } from "./gates.ts";
import { scaffoldProblem } from "./scaffold.ts";

/** 最小限の有効な unit 問題（python のみ）を書く。opts で部分的に壊して各ゲートを検証する */
async function writeFixture(
  root: string,
  opts: {
    id?: string;
    slug?: string;
    dirName?: string;
    category?: string;
    tier?: string;
    reviewed_by?: string;
    languages?: string;
    statement?: string;
    talkingPoints?: string;
    requirements?: string;
    title?: string;
    timeLimit?: number;
    withSolution?: boolean;
    pythonCommand?: string;
  } = {},
): Promise<string> {
  const id = opts.id ?? "be-0001";
  const slug = opts.slug ?? "token-bucket";
  const category = opts.category ?? "BE";
  const dirName = opts.dirName ?? `${id}-${slug}`;
  const dir = path.join(root, category, dirName);
  await fs.mkdir(path.join(dir, "starter"), { recursive: true });
  await fs.mkdir(path.join(dir, "solutions"), { recursive: true });
  await fs.mkdir(path.join(dir, "tests"), { recursive: true });
  const statement = opts.statement ?? "API のレートリミッタを token bucket で実装してください。容量とリフィル速度はコンストラクタで受け取り、allow(key, now) が許可の真偽を返します。同じ key の連続呼び出しが上限を超えたら拒否してください。";
  const talkingPoints =
    opts.talkingPoints ??
    `  - id: tp1
    text: token bucket の容量 capacity と refill_per_sec の 2 パラメータで burst と平均レートを分けて説明する
    weight: 2
  - id: tp2
    text: 時刻 now を引数で受け取りテスト可能にする（Date.now 直読みを避ける）
    weight: 2
  - id: tp3
    text: key ごとの Map が無限に増えるので最終アクセスでの掃除か LRU 上限に触れる
    weight: 1`;
  const requirements =
    opts.requirements ??
    `  - id: r1
    label: 上限を超えた呼び出しは拒否される
  - id: r2
    label: 時間が経てば再び許可される`;
  const md = `---
id: ${id}
slug: ${slug}
title: ${opts.title ?? "Token bucket レートリミッタ"}
category: ${category}
tier: ${opts.tier ?? "core"}
difficulty: L2
time_limit: ${opts.timeLimit ?? 20}
languages: [${opts.languages ?? "python"}]
starter_files:
  - path: rate_limiter.py
    language: python
    content_ref: starter/rate_limiter.py
talking_points:
${talkingPoints}
requirements:
${requirements}
rubric_hints:
  red_flags: ["Date.now を直接読んでいる"]
reference_solutions:
  python: solutions/rate_limiter.py
review:
  reviewed_by: ${opts.reviewed_by ?? "human"}
---

## 問題文

${statement}

## 制約

- 標準ライブラリのみ。

## 面接官メモ（非公開）

- burst と平均レートの違いを言えるか。

## 振り返り用解説（終了後のみ表示）

1. token bucket。
`;
  await fs.writeFile(path.join(dir, "problem.md"), md);
  await fs.writeFile(
    path.join(dir, "tests.json"),
    JSON.stringify({
      kind: "unit",
      harness: { python: { files: ["tests/test_rate_limiter.py"], command: opts.pythonCommand ?? "python3 -I -m unittest discover -v -s . -p test_rate_limiter.py" } },
      userEntry: { python: "rate_limiter.py" },
    }),
  );
  await fs.writeFile(path.join(dir, "starter/rate_limiter.py"), "class RateLimiter:\n    pass\n");
  if (opts.withSolution !== false) await fs.writeFile(path.join(dir, "solutions/rate_limiter.py"), "class RateLimiter:\n    pass\n");
  await fs.writeFile(path.join(dir, "tests/test_rate_limiter.py"), "import unittest\n");
  return dir;
}

async function tmpRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "lci-gates-"));
}

const errorsOf = (issues: Issue[], gate?: string) => issues.filter((i) => i.level === "error" && (!gate || i.gate === gate));

test("有効な問題はエラー 0", async () => {
  const root = await tmpRoot();
  await writeFixture(root);
  const r = await validateProblems(root);
  assert.equal(r.errors, 0, JSON.stringify(r.entries[0]?.issues));
  assert.equal(r.entries.length, 1);
});

test("G1: ディレクトリ名・カテゴリ・id 重複を検出", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { dirName: "be-0001-wrong-name" });
  await writeFixture(root, { id: "be-0001", slug: "dup", dirName: "be-0001-dup" });
  await writeFixture(root, { id: "fe-0002", slug: "misplaced", category: "BE" });
  const r = await validateProblems(root);
  const all = r.entries.flatMap((e) => e.issues);
  assert.ok(all.some((i) => i.gate === "G1" && /<id>-<slug>/.test(i.message)), "dir name");
  assert.ok(all.some((i) => i.gate === "G1" && /重複/.test(i.message)), "dup id");
  assert.ok(all.some((i) => i.gate === "G1" && /接頭辞/.test(i.message)), "prefix");
});

test("G1: zod 違反（time_limit=25）は読み込み失敗として報告される", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { timeLimit: 25 });
  const r = await validateProblems(root);
  assert.equal(r.entries[0]?.problem, null);
  assert.ok(errorsOf(r.entries[0]!.issues, "G1").some((i) => /time_limit/.test(i.message)));
});

test("G1b: 参照解の無い言語・テストが対応しない言語を列挙するとエラー", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { languages: "python, typescript" });
  const r = await validateProblems(root);
  const g1b = errorsOf(r.entries[0]!.issues, "G1b");
  assert.ok(g1b.some((i) => /reference_solutions\.typescript が無い/.test(i.message)));
  assert.ok(g1b.some((i) => /harness\.typescript/.test(i.message)));
});

test("G1b: 参照解ファイルが存在しないとエラー", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { withSolution: false });
  const r = await validateProblems(root);
  assert.ok(errorsOf(r.entries[0]!.issues, "G1b").some((i) => /存在しない/.test(i.message)));
});

test("G3: 問題文の長さ・talking_points/requirements の数・core の人手レビュー", async () => {
  const root = await tmpRoot();
  await writeFixture(root, {
    statement: "短い。",
    talkingPoints: "  - id: tp1\n    text: token bucket の容量を説明する\n    weight: 1",
    requirements: "  - id: r1\n    label: 拒否される",
    reviewed_by: "llm",
  });
  const r = await validateProblems(root);
  const g3 = errorsOf(r.entries[0]!.issues, "G3").map((i) => i.message);
  assert.ok(g3.some((m) => /短すぎる/.test(m)), g3.join("\n"));
  assert.ok(g3.some((m) => /talking_points が 1 個/.test(m)));
  assert.ok(g3.some((m) => /requirements が 1 個/.test(m)));
  // 人手レビュー未了は警告（エラーにはしない）
  assert.ok(!g3.some((m) => /人手レビュー未了/.test(m)));
  assert.ok(r.entries[0]!.issues.some((i) => i.gate === "G3" && i.level === "warn" && /人手レビュー未了/.test(i.message)));
});

test("G3: 600 字超の問題文はエラー", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { statement: "あ".repeat(601) });
  const r = await validateProblems(root);
  assert.ok(errorsOf(r.entries[0]!.issues, "G3").some((i) => /長すぎる/.test(i.message)));
});

test("G5: 短い・用語の無い talking_point はエラー", async () => {
  const root = await tmpRoot();
  await writeFixture(root, {
    talkingPoints: `  - id: tp1
    text: token bucket の容量 capacity と refill_per_sec を分けて説明する
  - id: tp2
    text: 気をつける
  - id: tp3
    text: ちゃんとやる。きちんとやる。`,
  });
  const r = await validateProblems(root);
  const g5 = errorsOf(r.entries[0]!.issues, "G5");
  assert.ok(g5.some((i) => /tp2/.test(i.message) && /短すぎる/.test(i.message)));
  assert.ok(g5.some((i) => /tp3/.test(i.message) && /用語/.test(i.message)));
  assert.ok(!g5.some((i) => /tp1/.test(i.message)));
});

test("DUP: 近似タイトルは警告（エラーではない）", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { id: "be-0001", slug: "a", title: "Token bucket レートリミッタ" });
  await writeFixture(root, { id: "be-0002", slug: "b", title: "Token Bucket レートリミッタ！" });
  const r = await validateProblems(root);
  assert.equal(r.errors, 0);
  assert.ok(r.entries.flatMap((e) => e.issues).some((i) => i.gate === "DUP" && i.level === "warn"));
});

test("TESTS: python -I と -m unittest <module> の組合せは警告", async () => {
  const root = await tmpRoot();
  await writeFixture(root, { pythonCommand: "python3 -I -m unittest -v test_rate_limiter" });
  const r = await validateProblems(root);
  assert.ok(r.entries[0]!.issues.some((i) => i.gate === "TESTS" && i.level === "warn" && /discover/.test(i.message)));
});

// ---- CP（05_cp_problems.md §8 T5） ---------------------------------------------------

/** 雛形から作った CP 問題に、sample 2 件・hidden 10 件（hidden-max 2 件）と問題文の入出力例を入れる */
async function writeCpFixture(root: string): Promise<string> {
  const { dir } = await scaffoldProblem(root, "CP", "pair-sum", { id: "cp-0001" });
  const cases: { name: string; visibility: "sample" | "hidden"; stdinFile: string; expectedFile: string }[] = [];
  const put = async (no: number, name: string, stdin: string, out: string) => {
    const stem = `tests/${String(no).padStart(2, "0")}`;
    await fs.writeFile(path.join(dir, `${stem}.in`), stdin);
    await fs.writeFile(path.join(dir, `${stem}.out`), out);
    cases.push({ name, visibility: name.startsWith("sample") ? "sample" : "hidden", stdinFile: `${stem}.in`, expectedFile: `${stem}.out` });
  };
  await put(1, "sample-1", "3\n1 2 3\n", "6\n");
  await put(2, "sample-2", "1\n-5\n", "-5\n");
  for (let i = 0; i < 8; i++) await put(11 + i, `hidden-rand-${i + 1}`, `1\n${i}\n`, `${i}\n`);
  await put(19, "hidden-max-1", "2\n1 1\n", "2\n");
  await put(20, "hidden-max-2", "2\n2 2\n", "4\n");
  const tj = JSON.parse(await fs.readFile(path.join(dir, "tests.json"), "utf8"));
  await fs.writeFile(path.join(dir, "tests.json"), JSON.stringify({ ...tj, cases }, null, 2));
  let md = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  // 入力例 1 はブロック、出力例 1 はインライン、入力例 2・出力例 2 はブロック（リスト内の字下げ付き）で書く
  md = md.replace(/入力例 1:[\s\S]*?出力例 2:\n\n```\nTODO\n```/, "入力例 1:\n\n```\n3\n1 2 3\n```\n\n出力例 1: `6`\n\n- 入力例 2:\n\n  ```\n  1\n  -5\n  ```\n\n- 出力例 2:\n\n  ```\n  -5\n  ```");
  await fs.writeFile(path.join(dir, "problem.md"), md);
  return dir;
}

const cpErrors = async (root: string) => {
  const r = await validateProblems(root);
  return r.entries.flatMap((e) => e.issues).filter((i) => i.gate === "CP");
};

test("CP: 6 言語・starter・sample と問題文の一致・hidden 10 件と hidden-max・gen.py が揃えば CP ゲートは通る", async () => {
  const root = await tmpRoot();
  await writeCpFixture(root);
  assert.deepEqual(await cpErrors(root), []);
});

test("CP: 言語の欠け・sample の不一致・hidden 不足・hidden-max 無し・gen.py 無しを検出", async () => {
  const root = await tmpRoot();
  const dir = await writeCpFixture(root);
  let md = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  md = md.replace("languages: [c, rust, python, go, typescript, php]", "languages: [c, rust, python, go, typescript]").replace(/\n  php: solutions\/php\/main\.php/, "");
  md = md.replace("出力例 1: `6`", "出力例 1: `7`").replace("```\n3\n1 2 3\n```", "```\n3\n1 2  3\n```");
  await fs.writeFile(path.join(dir, "problem.md"), md);
  const tj = JSON.parse(await fs.readFile(path.join(dir, "tests.json"), "utf8"));
  tj.cases = tj.cases.filter((c: { name: string }) => !c.name.startsWith("hidden-max"));
  await fs.writeFile(path.join(dir, "tests.json"), JSON.stringify(tj));
  await fs.rm(path.join(dir, "gen", "gen.py"));
  const msgs = (await cpErrors(root)).filter((i) => i.level === "error").map((i) => i.message);
  for (const re of [/languages に php が無い/, /sample-1 の入力が/, /sample-1 の期待出力が/, /hidden が 8 件/, /hidden-max-\* のケースが無い/, /gen\/gen\.py が無い/]) {
    assert.ok(msgs.some((m) => re.test(m)), `${re} が見つからない:\n${msgs.join("\n")}`);
  }
  // sample-2（字下げしたリスト内のブロック）は一致している
  assert.ok(!msgs.some((m) => /sample-2/.test(m)), msgs.join("\n"));
});

test("CP: サイズ上限（tests/ 合計・L1・.in/.out）と outputKb を検出", async () => {
  const root = await tmpRoot();
  const dir = await writeCpFixture(root);
  // 雛形は L2（種なし）。.in 2.6MB ×3 で合計も超える
  const big = "1\n" + "9".repeat(2_600_000) + "\n";
  for (const no of [11, 12, 13]) await fs.writeFile(path.join(dir, `tests/${no}.in`), big);
  await fs.writeFile(path.join(dir, "tests/14.out"), "8".repeat(1_100_000) + "\n");
  const msgs = (await cpErrors(root)).map((i) => i.message);
  assert.ok(msgs.some((m) => /tests\/ が .* KB（上限 6,000 KB）/.test(m)), msgs.join("\n"));
  assert.ok(msgs.some((m) => /tests\/11\.in が .*\.in の上限 2,500 KB/.test(m)));
  assert.ok(msgs.some((m) => /tests\/14\.out が .*\.out の上限 1,000 KB/.test(m)));
  assert.ok(msgs.some((m) => /hidden-rand-4: 期待出力 .* limits\.outputKb 1024 が小さい/.test(m)));

  // L1 は 200KB まで
  const root2 = await tmpRoot();
  const dir2 = await writeCpFixture(root2);
  const md = (await fs.readFile(path.join(dir2, "problem.md"), "utf8")).replace("difficulty: L2", "difficulty: L1");
  await fs.writeFile(path.join(dir2, "problem.md"), md);
  await fs.writeFile(path.join(dir2, "tests/11.in"), "1\n" + "1".repeat(250_000) + "\n");
  assert.ok((await cpErrors(root2)).some((i) => /L1 の tests\/ が/.test(i.message)));
});

test("CP: hidden-max が 1 件だけなら警告、CP 以外のカテゴリには CP ゲートを掛けない", async () => {
  const root = await tmpRoot();
  const dir = await writeCpFixture(root);
  const tj = JSON.parse(await fs.readFile(path.join(dir, "tests.json"), "utf8"));
  tj.cases = tj.cases.map((c: { name: string }) => (c.name === "hidden-max-2" ? { ...c, name: "hidden-rand-9" } : c));
  await fs.writeFile(path.join(dir, "tests.json"), JSON.stringify(tj));
  const issues = await cpErrors(root);
  assert.deepEqual(issues.map((i) => [i.level, /1 件だけ/.test(i.message)]), [["warn", true]]);

  const root2 = await tmpRoot();
  await writeFixture(root2);
  assert.deepEqual(await cpErrors(root2), []);
});

test("fencedBlocks: 字下げしたフェンスは字下げを外して中身を返す", () => {
  assert.deepEqual(fencedBlocks("a\n```\n1 2\n3\n```\n- x\n  ```text\n  4\n   5\n  ```\n"), ["1 2\n3", "4\n 5"]);
});
