import { test } from "node:test";
import assert from "node:assert/strict";
import { LRUCache } from "./lru.ts";

test("basic", () => {
  const c = new LRUCache(2);
  c.put(1, 1);
  c.put(2, 2);
  assert.equal(c.get(1), 1);
  c.put(3, 3);
  assert.equal(c.get(2), -1);
  c.put(4, 4);
  assert.equal(c.get(1), -1);
  assert.equal(c.get(3), 3);
  assert.equal(c.get(4), 4);
});

test("missing returns -1", () => {
  assert.equal(new LRUCache(1).get(42), -1);
});

test("get refreshes recency", () => {
  const c = new LRUCache(2);
  c.put(1, 1);
  c.put(2, 2);
  c.get(1);
  c.put(3, 3);
  assert.equal(c.get(1), 1, "get した 1 は追い出されないはず");
  assert.equal(c.get(2), -1);
});

test("update does not evict", () => {
  const c = new LRUCache(2);
  c.put(1, 1);
  c.put(2, 2);
  c.put(1, 10);
  assert.equal(c.get(1), 10);
  assert.equal(c.get(2), 2, "既存キーの更新で 2 を追い出してはいけない");
});

test("capacity one", () => {
  const c = new LRUCache(1);
  c.put(1, 1);
  c.put(2, 2);
  assert.equal(c.get(1), -1);
  assert.equal(c.get(2), 2);
});

test("large ops", () => {
  const c = new LRUCache(3000);
  const t0 = performance.now();
  for (let i = 0; i < 100000; i++) {
    c.put(i % 10000, i);
    c.get((i * 7) % 10000);
  }
  assert.ok(performance.now() - t0 < 2000, "O(1) で動いていない可能性");
  assert.equal(c.get(99999 % 10000), 99999);
});
