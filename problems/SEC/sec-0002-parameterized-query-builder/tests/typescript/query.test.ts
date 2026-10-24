import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildPostSearch, type Filters } from "./query.ts";

const ROWS: [number, number, string, string, number, number][] = [
  [1, 10, "夕焼けの街", "published", 1000, 5],
  [2, 10, "100% オリジナル", "published", 2000, 50],
  [3, 20, "1000 users 記念", "draft", 3000, 50],
  [4, 20, "a_b テスト", "published", 4000, 1],
  [5, 30, "axb テスト", "archived", 5000, 0],
  [6, 30, "C:\\path の話", "published", 6000, 7],
  [7, 10, "It's a cat", "published", 7000, 99],
];

function db() {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE posts(id INTEGER PRIMARY KEY, author_id INTEGER, title TEXT, status TEXT, created_at INTEGER, like_count INTEGER)");
  const ins = d.prepare("INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?)");
  for (const r of ROWS) ins.run(...r);
  return d;
}

function run(d: DatabaseSync, filters: Filters, sort?: string, limit?: number): number[] {
  const { sql, params } = buildPostSearch(filters, sort, limit);
  assert.ok(Array.isArray(params));
  return d.prepare(sql).all(...params).map((r) => Number(Object.values(r as Record<string, unknown>)[0]));
}

const intact = (d: DatabaseSync) => assert.equal(Number((d.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number }).n), ROWS.length);

test("no filters, default sort and limit", () => {
  const d = db();
  assert.deepEqual(run(d, {}), [7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(run(d, {}, undefined, 2), [7, 6]);
});

test("author and status", () => assert.deepEqual(run(db(), { author_id: 10, status: "published" }), [7, 2, 1]));

test("created range is inclusive", () => {
  assert.deepEqual(run(db(), { created_from: 2000, created_to: 4000 }, "created_at"), [2, 3, 4]);
});

test("sorts", () => {
  const d = db();
  assert.deepEqual(run(d, {}, "-like_count"), [7, 3, 2, 6, 1, 4, 5]);
  assert.deepEqual(run(d, {}, "like_count"), [5, 4, 1, 6, 3, 2, 7]);
  assert.deepEqual(run(d, {}, "id"), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(run(d, {}, "-id"), [7, 6, 5, 4, 3, 2, 1]);
});

test("title_contains", () => assert.deepEqual(run(db(), { title_contains: "テスト" }, "id"), [4, 5]));

test("LIKE wildcards are literal", () => {
  const d = db();
  assert.deepEqual(run(d, { title_contains: "100%" }), [2]);
  assert.deepEqual(run(d, { title_contains: "a_b" }), [4]);
  assert.deepEqual(run(d, { title_contains: "%" }), [2]);
  assert.deepEqual(run(d, { title_contains: "C:\\" }), [6]);
});

test("quote in value", () => assert.deepEqual(run(db(), { title_contains: "It's" }), [7]));

test("injection in value", () => {
  const d = db();
  for (const payload of ["x' OR '1'='1", "'; DROP TABLE posts; --", "%' OR 1=1 --"]) {
    const { sql, params } = buildPostSearch({ title_contains: payload });
    assert.ok(!sql.includes(payload));
    assert.deepEqual(d.prepare(sql).all(...params), []);
    intact(d);
  }
});

test("injection in sort is rejected", () => {
  for (const bad of ["created_at; DROP TABLE posts", "created_at DESC", "title", "(SELECT 1)", "", "-", "constructor", "__proto__"]) {
    assert.throws(() => buildPostSearch({}, bad), bad);
  }
});

test("type checks", () => {
  const bad = [{ author_id: "1 OR 1=1" }, { author_id: 1.5 }, { author_id: true }, { created_from: "0" }, { title_contains: 123 }, { ids: [1, "2"] }, { ids: "1,2" }];
  for (const f of bad) assert.throws(() => buildPostSearch(f as unknown as Filters), JSON.stringify(f));
});

test("status allowlist", () => assert.throws(() => buildPostSearch({ status: "published' OR '1'='1" })));

test("unknown keys are rejected", () => {
  for (const f of [{ "author_id = 1 OR 1": 1 }, { title: "x" }, { "1=1; --": 0 }]) assert.throws(() => buildPostSearch(f as unknown as Filters));
});

test("ids", () => {
  const d = db();
  assert.deepEqual(run(d, { ids: [3, 1, 99] }, "id"), [1, 3]);
  assert.deepEqual(run(d, { ids: [] }), []);
  assert.throws(() => buildPostSearch({ ids: Array.from({ length: 101 }, (_, i) => i) }));
});

test("limit bounds", () => {
  for (const bad of [0, -1, 101]) assert.throws(() => buildPostSearch({}, undefined, bad));
  assert.equal(run(db(), {}, undefined, 100).length, 7);
});

test("combined", () => assert.deepEqual(run(db(), { author_id: 20, created_from: 3500, title_contains: "テスト" }), [4]));
