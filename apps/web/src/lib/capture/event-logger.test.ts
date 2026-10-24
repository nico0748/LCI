import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@lci/core";
import { createClock } from "./clock.ts";
import { EventLogger, MemoryPendingStorage, type EventSink } from "./event-logger.ts";

function harness(opts: { failTimes?: number; startSeq?: number; storage?: MemoryPendingStorage } = {}) {
  const sent: Event[][] = [];
  let fail = opts.failTimes ?? 0;
  const sink: EventSink = {
    async send(_id, events) {
      if (fail > 0) {
        fail--;
        return false;
      }
      sent.push(events);
      return true;
    },
    beacon(_id, events) {
      sent.push(events);
      return true;
    },
  };
  const timers: (() => void)[] = [];
  const storage = opts.storage ?? new MemoryPendingStorage();
  const logger = new EventLogger({
    sessionId: "s1",
    clock: createClock({ nowFn: () => 1234, origin: 0 }),
    sink,
    storage,
    startSeq: opts.startSeq,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  const fireTimers = () => {
    const fs = timers.splice(0);
    for (const f of fs) f();
  };
  return { logger, sent, storage, fireTimers, timers };
}

test("seq は単調増加、t は省略時に時計から埋まる", () => {
  const { logger } = harness();
  const a = logger.log({ type: "session_start" });
  const b = logger.log({ type: "marker", label: "x" });
  assert.equal(a.seq, 1);
  assert.equal(b.seq, 2);
  assert.equal(a.t, 1234);
  assert.equal(logger.nextSeq(), 3);
});

test("50 件たまると即フラッシュ、それ未満はタイマで送る", async () => {
  const { logger, sent, fireTimers, timers } = harness();
  for (let i = 0; i < 49; i++) logger.log({ type: "marker", label: String(i) });
  assert.equal(sent.length, 0);
  assert.equal(timers.length, 1, "1 本だけタイマが張られる");
  logger.log({ type: "marker", label: "49" });
  await logger.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.length, 50);
  logger.log({ type: "marker", label: "50" });
  fireTimers();
  await logger.flush();
  assert.equal(sent.length, 2);
  assert.equal(sent[1]!.length, 1);
});

test("送信失敗したバッチは順序を保って再送され、ACK まで IndexedDB 相当に残る", async () => {
  const { logger, sent, storage, fireTimers } = harness({ failTimes: 1 });
  logger.log({ type: "marker", label: "a" });
  logger.log({ type: "marker", label: "b" });
  await logger.flush();
  assert.equal(sent.length, 0);
  assert.equal(storage.map.size, 1, "未 ACK バッチが保持される");
  assert.equal(logger.stats.failures, 1);
  logger.log({ type: "marker", label: "c" });
  fireTimers();
  await logger.flush();
  assert.equal(sent.length, 1);
  assert.deepEqual(
    sent[0]!.map((e) => e.seq),
    [1, 2, 3],
  );
  assert.equal(storage.map.size, 0, "ACK 後に消える");
});

test("replayPending: 前回の未送信バッチを再送し seq を引き継ぐ", async () => {
  const storage = new MemoryPendingStorage();
  await storage.put({ key: "s1:7", sessionId: "s1", events: [{ t: 10, seq: 7, type: "marker", label: "old" }] });
  await storage.put({ key: "other:1", sessionId: "other", events: [{ t: 10, seq: 1, type: "marker", label: "x" }] });
  const { logger, sent } = harness({ storage, startSeq: 3 });
  const max = await logger.replayPending();
  assert.equal(max, 7);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]![0]!.seq, 7);
  assert.equal(storage.map.size, 1, "別セッションのものは触らない");
  const next = logger.log({ type: "marker", label: "new" });
  assert.equal(next.seq, 8);
});

test("beaconRemaining: 残りをまとめて beacon に渡す", () => {
  const { logger, sent } = harness();
  logger.log({ type: "marker", label: "a" });
  logger.log({ type: "marker", label: "b" });
  logger.beaconRemaining();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.length, 2);
});
