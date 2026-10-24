import test from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "./rate_limiter.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);

test("burst up to capacity", () => {
  const rl = new RateLimiter(3, 1);
  assert.deepEqual([0, 1, 2, 3].map(() => rl.allow("u1", 0)), [true, true, true, false]);
});

test("refill over time", () => {
  const rl = new RateLimiter(3, 1);
  for (let i = 0; i < 3; i++) rl.allow("u1", 0);
  assert.equal(rl.allow("u1", 0.5), false);
  assert.equal(rl.allow("u1", 1), true);
  assert.equal(rl.allow("u1", 1), false);
});

test("refill is capped at capacity", () => {
  const rl = new RateLimiter(3, 1);
  rl.allow("u1", 0);
  assert.deepEqual([0, 1, 2, 3].map(() => rl.allow("u1", 100)), [true, true, true, false]);
});

test("keys are independent", () => {
  const rl = new RateLimiter(1, 1);
  assert.equal(rl.allow("a", 0), true);
  assert.equal(rl.allow("a", 0), false);
  assert.equal(rl.allow("b", 0), true);
});

test("fractional refill", () => {
  const rl = new RateLimiter(1, 0.5);
  assert.equal(rl.allow("u", 0), true);
  assert.equal(rl.allow("u", 1), false);
  assert.equal(rl.allow("u", 2), true);
});

test("denied call does not consume", () => {
  const rl = new RateLimiter(1, 1);
  assert.equal(rl.allow("u", 0), true);
  for (const t of [0.1, 0.2, 0.3]) assert.equal(rl.allow("u", t), false);
  assert.equal(rl.allow("u", 1), true);
});

test("retryAfter", () => {
  const rl = new RateLimiter(1, 0.5);
  close(rl.retryAfter("u", 0), 0);
  assert.equal(rl.allow("u", 0), true);
  close(rl.retryAfter("u", 0), 2);
  close(rl.retryAfter("u", 1.5), 0.5);
  close(rl.retryAfter("u", 2), 0);
  assert.equal(rl.allow("u", 2), true);
});

test("retryAfter does not consume", () => {
  const rl = new RateLimiter(2, 1);
  rl.retryAfter("u", 0);
  rl.retryAfter("u", 0);
  assert.equal(rl.allow("u", 0), true);
  assert.equal(rl.allow("u", 0), true);
});

test("clock going backwards", () => {
  const rl = new RateLimiter(2, 1);
  assert.equal(rl.allow("u", 10), true);
  assert.equal(rl.allow("u", 10), true);
  assert.equal(rl.allow("u", 5), false);
  assert.equal(rl.allow("u", 10.5), false);
  assert.equal(rl.allow("u", 11), true);
  assert.equal(rl.allow("u", 11), false);
});

test("invalid config throws", () => {
  for (const [cap, refill] of [[0, 1], [-1, 1], [1, 0], [1, -2], [1.5, 1]] as const) {
    assert.throws(() => new RateLimiter(cap, refill));
  }
});
