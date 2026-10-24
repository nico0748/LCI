import test from "node:test";
import assert from "node:assert/strict";
import { loadEntries, idPrefix } from "./gates.ts";
import { problemsRoot } from "./paths.ts";
import { readSeeds, readTargets, CATEGORIES, DIFFICULTIES, type Seed } from "./stats.ts";

/**
 * problems/_catalog/{targets,seeds}.json の整合性。
 * seeds.json は scripts/make-seeds.ts が生成する。ここでは生成物が 04 §2.2 の表と一致することを検査する。
 */

const ROOT = problemsRoot();

test("targets.json: 9 カテゴリの合計が 500、難易度内訳の和がカテゴリ目標に一致", async () => {
  const t = await readTargets(ROOT);
  assert.equal(t.total, 500);
  let sum = 0;
  for (const c of CATEGORIES) {
    const cat = t.categories[c];
    assert.ok(cat, c);
    const bySum = DIFFICULTIES.reduce((a, d) => a + (cat.by_difficulty[d] ?? 0), 0);
    assert.equal(bySum, cat.total, `${c} の難易度内訳の和`);
    sum += cat.total;
  }
  assert.equal(sum, 500);
});

test("seeds.json: 500 件・id 一意・カテゴリ×難易度の件数が targets と完全一致", async () => {
  const loaded = await readSeeds(ROOT);
  assert.ok(loaded, "seeds.json が無い（pnpm --filter @lci/problem-tools make-seeds）");
  const seeds: Seed[] = loaded;
  const t = await readTargets(ROOT);
  assert.equal(seeds.length, 500);
  const ids = new Set(seeds.map((s) => s.id));
  assert.equal(ids.size, 500, "id が重複している");
  const titles = new Set(seeds.map((s) => s.title));
  assert.equal(titles.size, 500, "title が重複している");
  for (const c of CATEGORIES) {
    const cat = t.categories[c]!;
    const mine = seeds.filter((s) => s.category === c);
    assert.equal(mine.length, cat.total, `${c} の件数`);
    for (const d of DIFFICULTIES) {
      assert.equal(mine.filter((s) => s.difficulty === d).length, cat.by_difficulty[d], `${c} ${d} の件数`);
    }
    // id は fe-0001 … fe-0110 のように欠番なく連番
    const nums = mine.map((s) => Number(s.id.slice(s.id.indexOf("-") + 1))).sort((a, b) => a - b);
    assert.deepEqual(nums, Array.from({ length: cat.total }, (_, i) => i + 1), `${c} の id 連番`);
    for (const s of mine) assert.ok(s.id.startsWith(`${idPrefix(c)}-`), s.id);
  }
});

test("seeds.json: 実在する問題と id・カテゴリ・タイトルが一致し status が core/generated になっている", async () => {
  const seeds = await readSeeds(ROOT);
  assert.ok(seeds);
  const byId = new Map(seeds.map((s) => [s.id, s]));
  const entries = await loadEntries(ROOT);
  for (const e of entries) {
    if (!e.problem) continue;
    const m = e.problem.meta;
    const s = byId.get(m.id);
    assert.ok(s, `${m.id} が seeds.json に無い（make-seeds を再実行）`);
    assert.equal(s.category, m.category, `${m.id} のカテゴリ`);
    assert.equal(s.title, m.title, `${m.id} のタイトルが seeds と一致しない（make-seeds を再実行）`);
    assert.equal(s.difficulty, m.difficulty, `${m.id} の難易度`);
    assert.equal(s.status, m.tier === "core" ? "core" : "generated", `${m.id} の status`);
  }
});
