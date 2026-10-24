import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock, recoveredOrigin } from "./clock.ts";

test("createClock: t は原点からの経過ミリ秒で単調増加、負にならない", () => {
  let now = 1000;
  const clock = createClock({ nowFn: () => now });
  assert.equal(clock.now(), 0);
  now = 1532.4;
  assert.equal(clock.now(), 532);
  now = 900; // 原点より前は 0 に丸める（起きないはずだが負値を出さない）
  assert.equal(clock.now(), 0);
  assert.equal(clock.fromTimeStamp(2500), 1500);
});

test("recoveredOrigin: 壁時計の経過で原点を遡らせる", () => {
  const wallStart = "2026-10-24T10:00:00.000Z";
  const wallNow = new Date("2026-10-24T10:05:00.000Z").getTime();
  const origin = recoveredOrigin(wallStart, () => 50_000, wallNow);
  const clock = createClock({ nowFn: () => 50_000, origin });
  assert.equal(clock.now(), 5 * 60 * 1000);
});
