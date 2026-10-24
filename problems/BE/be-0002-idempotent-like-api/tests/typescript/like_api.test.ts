import test from "node:test";
import assert from "node:assert/strict";
import { LikeApi } from "./like_api.ts";

function setup() {
  const clock = { t: 1000 };
  const api = new LikeApi(() => clock.t);
  return { clock, api };
}

test("first like is 201", () => {
  const { api } = setup();
  assert.deepEqual(api.like("u1", "p1", "k1"), { status: 201, body: { post_id: "p1", liked: true, like_count: 1 } });
});

test("double like without key does not double count", () => {
  const { api } = setup();
  assert.equal(api.like("u1", "p1").status, 201);
  const r = api.like("u1", "p1");
  assert.equal(r.status, 200);
  assert.equal(r.body.like_count, 1);
  assert.equal(api.count("p1"), 1);
});

test("different keys for the same like do not double count", () => {
  const { api } = setup();
  api.like("u1", "p1", "k1");
  assert.equal(api.like("u1", "p1", "k2").status, 200);
  assert.equal(api.count("p1"), 1);
});

test("replay returns the saved response even if count changed", () => {
  const { api } = setup();
  const first = api.like("u1", "p1", "k1");
  api.like("u2", "p1", "x");
  assert.equal(api.count("p1"), 2);
  const replay = api.like("u1", "p1", "k1");
  assert.deepEqual(replay, first);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.like_count, 1);
  assert.equal(api.count("p1"), 2);
});

test("mutating a returned body does not corrupt the saved response", () => {
  const { api } = setup();
  const r = api.like("u1", "p1", "k1");
  r.body.like_count = 999;
  assert.equal(api.like("u1", "p1", "k1").body.like_count, 1);
});

test("key reused for another post is 422", () => {
  const { api } = setup();
  api.like("u1", "p1", "k1");
  assert.deepEqual(api.like("u1", "p2", "k1"), { status: 422, body: { error: "idempotency_key_reused" } });
  assert.equal(api.count("p2"), 0);
});

test("key reused for another operation is 422", () => {
  const { api } = setup();
  api.like("u1", "p1", "k1");
  assert.equal(api.unlike("u1", "p1", "k1").status, 422);
  assert.equal(api.count("p1"), 1);
});

test("keys are scoped per user", () => {
  const { api } = setup();
  assert.equal(api.like("u1", "p1", "same").status, 201);
  const r = api.like("u2", "p1", "same");
  assert.equal(r.status, 201);
  assert.equal(r.body.like_count, 2);
});

test("unlike, never below zero", () => {
  const { api } = setup();
  api.like("u1", "p1");
  assert.deepEqual(api.unlike("u1", "p1"), { status: 200, body: { post_id: "p1", liked: false, like_count: 0 } });
  assert.equal(api.unlike("u1", "p1").body.like_count, 0);
  assert.equal(api.unlike("u9", "p1").body.like_count, 0);
  assert.equal(api.count("p1"), 0);
});

test("like again after unlike", () => {
  const { api } = setup();
  api.like("u1", "p1", "a");
  api.unlike("u1", "p1", "b");
  assert.equal(api.like("u1", "p1", "c").status, 201);
  assert.equal(api.count("p1"), 1);
});

test("replay after unlike returns the original response", () => {
  const { api } = setup();
  const first = api.like("u1", "p1", "k1");
  api.unlike("u1", "p1", "k2");
  assert.deepEqual(api.like("u1", "p1", "k1"), first);
  assert.equal(api.count("p1"), 0);
});

test("key expires after 24h", () => {
  const { api, clock } = setup();
  api.like("u1", "p1", "k1");
  clock.t += 86400 - 1;
  assert.equal(api.like("u1", "p2", "k1").status, 422);
  clock.t += 2;
  assert.equal(api.like("u1", "p2", "k1").status, 201);
});

test("invalid request is 400 and not stored", () => {
  const { api } = setup();
  assert.deepEqual(api.like("u1", "", "k1"), { status: 400, body: { error: "invalid_request" } });
  assert.deepEqual(api.like("", "p1", "k1"), { status: 400, body: { error: "invalid_request" } });
  assert.equal(api.like("u1", "p1", "k1").status, 201);
});
