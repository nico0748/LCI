import test from "node:test";
import assert from "node:assert/strict";
import { itemsInPeriod, paginate } from "./billing.ts";

const items = (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`);

test("reported case: 40 items", () => {
  const p2 = paginate(items(40), 2);
  assert.deepEqual(p2.items, items(40).slice(20, 40));
  assert.equal(p2.totalPages, 2);
  assert.equal(p2.hasNext, false);
});

test("first page", () => {
  const p1 = paginate(items(45), 1);
  assert.deepEqual(p1.items, items(45).slice(0, 20));
  assert.equal(p1.page, 1);
  assert.equal(p1.hasNext, true);
});

test("partial last page", () => {
  const p3 = paginate(items(41), 3);
  assert.deepEqual(p3.items, ["item-40"]);
  assert.equal(p3.totalPages, 3);
  assert.equal(p3.hasNext, false);
});

test("zero items is one empty page", () => {
  assert.deepEqual(paginate([], 1), { items: [], page: 1, totalPages: 1, hasNext: false });
});

test("out of range throws RangeError", () => {
  for (const [n, page] of [[40, 3], [40, 0], [0, 2], [5, -1]] as const) assert.throws(() => paginate(items(n), page), RangeError);
});

test("every item exactly once", () => {
  for (const perPage of [1, 3, 20]) {
    for (let n = 0; n < 62; n++) {
      const seen: string[] = [];
      let page = 1;
      let last = paginate(items(n), 1, perPage);
      for (;;) {
        last = paginate(items(n), page, perPage);
        assert.ok(last.items.length <= perPage);
        seen.push(...last.items);
        if (!last.hasNext) break;
        page++;
      }
      assert.deepEqual(seen, items(n), `n=${n} perPage=${perPage}`);
      assert.equal(page, last.totalPages);
    }
  }
});

test("period bounds are inclusive", () => {
  const rows = Array.from({ length: 32 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 2, 31 + i));
    return { id: i, billed_on: d.toISOString().slice(0, 10) };
  });
  const got = itemsInPeriod(rows, "2026-04-01", "2026-04-30");
  assert.deepEqual(
    got.map((r) => r.id),
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  assert.equal(got[0]?.billed_on, "2026-04-01");
  assert.equal(got.at(-1)?.billed_on, "2026-04-30");
});

test("single day keeps the original order", () => {
  const rows = [
    { id: "b", billed_on: "2026-04-15" },
    { id: "a", billed_on: "2026-04-15" },
    { id: "c", billed_on: "2026-04-16" },
  ];
  assert.deepEqual(
    itemsInPeriod(rows, "2026-04-15", "2026-04-15").map((r) => r.id),
    ["b", "a"],
  );
});
