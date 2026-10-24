import test from "node:test";
import assert from "node:assert/strict";
import { paginate, type Post, type Page } from "./pagination.ts";

const post = (id: number, t: number): Post => ({ id, created_at: t, title: `post ${id}` });
const ids = (p: Page) => p.items.map((x) => x.id);

function walk(posts: Post[], limit: number): { out: number[]; pages: number } {
  const out: number[] = [];
  let cursor: string | null = null;
  let pages = 0;
  for (;;) {
    const page = paginate(posts, limit, cursor);
    out.push(...ids(page));
    pages++;
    cursor = page.nextCursor;
    if (cursor === null || pages > 1000) return { out, pages };
  }
}

// 再現可能な擬似乱数（テストを決定的にするため）
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test("first page is newest first", () => {
  const page = paginate([post(1, 100), post(2, 200), post(3, 300), post(4, 400)], 2);
  assert.deepEqual(ids(page), [4, 3]);
  assert.equal(typeof page.nextCursor, "string");
});

test("following pages", () => {
  const posts = [1, 2, 3, 4, 5].map((i) => post(i, i * 10));
  const p1 = paginate(posts, 2);
  const p2 = paginate(posts, 2, p1.nextCursor);
  const p3 = paginate(posts, 2, p2.nextCursor);
  assert.deepEqual([...ids(p1), ...ids(p2), ...ids(p3)], [5, 4, 3, 2, 1]);
  assert.equal(p3.nextCursor, null);
});

test("unsorted input", () => {
  assert.deepEqual(walk([post(3, 300), post(1, 100), post(4, 400), post(2, 200)], 3).out, [4, 3, 2, 1]);
});

test("new posts inserted between pages cause no duplicates", () => {
  const posts = [1, 2, 3, 4, 5, 6].map((i) => post(i, i * 10));
  const p1 = paginate(posts, 3);
  assert.deepEqual(ids(p1), [6, 5, 4]);
  posts.push(post(7, 70), post(8, 80));
  assert.deepEqual(ids(paginate(posts, 3, p1.nextCursor)), [3, 2, 1]);
});

test("ties on created_at across a page boundary", () => {
  const posts = [post(1, 100), post(2, 200), post(3, 200), post(4, 200), post(5, 200), post(6, 300)];
  assert.deepEqual(walk(posts, 2).out, [6, 5, 4, 3, 2, 1]);
});

test("all posts share one timestamp", () => {
  const posts = Array.from({ length: 10 }, (_, i) => post(i + 1, 500));
  assert.deepEqual(walk(posts, 3).out, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test("exact multiple has no trailing empty page", () => {
  const posts = [1, 2, 3, 4, 5, 6].map((i) => post(i, i));
  const p1 = paginate(posts, 3);
  const p2 = paginate(posts, 3, p1.nextCursor);
  assert.deepEqual(ids(p2), [3, 2, 1]);
  assert.equal(p2.nextCursor, null);
  assert.equal(walk(posts, 3).pages, 2);
});

test("cursor still works after the referenced post is deleted", () => {
  let posts = [1, 2, 3, 4, 5, 6].map((i) => post(i, i * 10));
  const p1 = paginate(posts, 3);
  posts = posts.filter((p) => p.id !== 4);
  assert.deepEqual(ids(paginate(posts, 3, p1.nextCursor)), [3, 2, 1]);
});

test("empty input", () => {
  assert.deepEqual(paginate([], 10), { items: [], nextCursor: null });
});

test("limit is clamped to 100", () => {
  const posts = Array.from({ length: 250 }, (_, i) => post(i + 1, i + 1));
  const page = paginate(posts, 1000);
  assert.equal(page.items.length, 100);
  assert.notEqual(page.nextCursor, null);
});

test("invalid limit throws", () => {
  assert.throws(() => paginate([post(1, 1)], 0));
  assert.throws(() => paginate([post(1, 1)], -5));
});

test("invalid cursor throws", () => {
  for (const bad of ["%%%", "abc", "!!!!"]) assert.throws(() => paginate([post(1, 1)], 10, bad), bad);
});

test("large random walk matches sorted order", () => {
  const r = rng(42);
  const posts = Array.from({ length: 300 }, (_, i) => post(i + 1, Math.floor(r() * 51)));
  const expected = [...posts].sort((a, b) => b.created_at - a.created_at || b.id - a.id).map((p) => p.id);
  for (const limit of [1, 7, 50, 100]) assert.deepEqual(walk(posts, limit).out, expected);
});
