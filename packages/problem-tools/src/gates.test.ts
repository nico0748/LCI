import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateProblems, type Issue } from "./gates.ts";

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
