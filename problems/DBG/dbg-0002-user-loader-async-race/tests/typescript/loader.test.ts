import test from "node:test";
import assert from "node:assert/strict";
import { UserLoader, type User } from "./loader.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// id ごとに遅延を変えられ、呼び出し回数を数える偽のユーザー API
function fakeApi(opts: { delays?: Record<string, number>; failTimes?: Record<string, number> } = {}) {
  const calls: Record<string, number> = {};
  const failTimes = { ...(opts.failTimes ?? {}) };
  const fetcher = async (id: string): Promise<User> => {
    calls[id] = (calls[id] ?? 0) + 1;
    await sleep(opts.delays?.[id] ?? 10);
    if ((failTimes[id] ?? 0) > 0) {
      failTimes[id]!--;
      throw new Error(`api down: ${id}`);
    }
    return { id, name: `user ${id}` };
  };
  return { calls, fetcher };
}

test("load and cache", async () => {
  const api = fakeApi();
  const loader = new UserLoader(api.fetcher);
  assert.deepEqual(await loader.load("u1"), { id: "u1", name: "user u1" });
  assert.deepEqual(await loader.load("u1"), { id: "u1", name: "user u1" });
  assert.deepEqual(api.calls, { u1: 1 });
});

test("concurrent loads fetch once", async () => {
  const api = fakeApi();
  const loader = new UserLoader(api.fetcher);
  const users = await Promise.all(Array.from({ length: 20 }, () => loader.load("u1")));
  assert.deepEqual(api.calls, { u1: 1 });
  for (const u of users) assert.deepEqual(u, { id: "u1", name: "user u1" });
});

test("loadMany waits and keeps the input order", async () => {
  const api = fakeApi({ delays: { a: 50, b: 10, c: 30 } });
  const users = await new UserLoader(api.fetcher).loadMany(["a", "b", "c"]);
  assert.deepEqual(
    users.map((u) => u.id),
    ["a", "b", "c"],
  );
});

test("loadMany with duplicates", async () => {
  const api = fakeApi({ delays: { a: 30, b: 10 } });
  const users = await new UserLoader(api.fetcher).loadMany(["a", "b", "a", "a", "b"]);
  assert.deepEqual(
    users.map((u) => u.id),
    ["a", "b", "a", "a", "b"],
  );
  assert.deepEqual(api.calls, { a: 1, b: 1 });
});

test("loadMany with no ids", async () => assert.deepEqual(await new UserLoader(fakeApi().fetcher).loadMany([]), []));

test("failure is not cached", async () => {
  const api = fakeApi({ failTimes: { u1: 1 } });
  const loader = new UserLoader(api.fetcher);
  await assert.rejects(loader.load("u1"));
  assert.equal((await loader.load("u1")).id, "u1");
  assert.deepEqual(api.calls, { u1: 2 });
  await loader.load("u1");
  assert.deepEqual(api.calls, { u1: 2 });
});

test("a concurrent failure is shared, then retried", async () => {
  const api = fakeApi({ failTimes: { u1: 1 } });
  const loader = new UserLoader(api.fetcher);
  const results = await Promise.allSettled([loader.load("u1"), loader.load("u1")]);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.deepEqual(api.calls, { u1: 1 });
  assert.equal((await loader.load("u1")).id, "u1");
  assert.deepEqual(api.calls, { u1: 2 });
});

test("loadMany fails if any user fails", async () => {
  const api = fakeApi({ failTimes: { b: 1 } });
  const loader = new UserLoader(api.fetcher);
  await assert.rejects(loader.loadMany(["a", "b", "c"]));
  const users = await loader.loadMany(["a", "b", "c"]);
  assert.deepEqual(
    users.map((u) => u.id),
    ["a", "b", "c"],
  );
  assert.equal(api.calls.a, 1);
  assert.equal(api.calls.b, 2);
});

test("clear", async () => {
  const api = fakeApi();
  const loader = new UserLoader(api.fetcher);
  await loader.load("u1");
  loader.clear("u1");
  await loader.load("u1");
  assert.deepEqual(api.calls, { u1: 2 });
  loader.clear("never-loaded");
});
