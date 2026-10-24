import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { applyEdit, reconstructFileAt } from "./timeline.ts";
import { computeMetrics, extractTerms } from "./metrics.ts";
import { loadProblemDir, listProblemDirs } from "./problem-loader.ts";
import type { Event, TranscriptSegment } from "./session.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../problems");

test("applyEdit: insert and replace with Monaco 1-based ranges", () => {
  let t = "abc\ndef\n";
  t = applyEdit(t, [{ range: [1, 4, 1, 4], rangeLength: 0, text: "X" }]);
  assert.equal(t, "abcX\ndef\n");
  t = applyEdit(t, [{ range: [2, 1, 2, 4], rangeLength: 3, text: "ghi" }]);
  assert.equal(t, "abcX\nghi\n");
  // 2 changes in one event (Monaco orders them descending)
  t = applyEdit(t, [
    { range: [2, 1, 2, 1], rangeLength: 0, text: "> " },
    { range: [1, 1, 1, 1], rangeLength: 0, text: "> " },
  ]);
  assert.equal(t, "> abcX\n> ghi\n");
});

test("reconstructFileAt uses latest snapshot then edits", async () => {
  const events: Event[] = [
    { t: 0, seq: 1, type: "session_start" },
    { t: 10, seq: 2, type: "snapshot", file: "f1", version: 1, ref: "s1", sha1: "" },
    { t: 20, seq: 3, type: "edit", file: "f1", version: 2, changes: [{ range: [1, 1, 1, 1], rangeLength: 0, text: "A" }], undo: false, flush: false },
    { t: 30, seq: 4, type: "edit", file: "f1", version: 3, changes: [{ range: [1, 2, 1, 2], rangeLength: 0, text: "B" }], undo: false, flush: false },
  ];
  const resolver = { read: async () => "" };
  assert.equal((await reconstructFileAt(events, "f1", 25, resolver)).text, "A");
  assert.equal((await reconstructFileAt(events, "f1", 30, resolver)).text, "AB");
});

test("fe-0001 problem loads and validates", async () => {
  const dirs = await listProblemDirs(ROOT);
  assert.ok(dirs.includes("FE/fe-0001-search-form-cache"));
  const p = await loadProblemDir(ROOT, "FE/fe-0001-search-form-cache");
  assert.equal(p.meta.id, "fe-0001");
  assert.equal(p.tests.kind, "web");
  assert.ok(p.body.statement.includes("貧弱"));
  assert.ok(p.meta.starter_files[0]?.content?.includes("<script>"));
});

test("metrics: silence and talking point detection", async () => {
  const p = await loadProblemDir(ROOT, "FE/fe-0001-search-form-cache");
  const segments: TranscriptSegment[] = [
    { id: 1, start_ms: 0, end_ms: 3000, t_start: 1000, t_end: 4000, text: "まず空のクエリはリクエストを送らないようにします", is_filler: false, words: [] },
    { id: 2, start_ms: 30000, end_ms: 33000, t_start: 31000, t_end: 34000, text: "同じクエリはキャッシュのMapから返してTTLで古いのを捨てます", is_filler: false, words: [] },
  ];
  const events: Event[] = [
    { t: 0, seq: 1, type: "session_start" },
    { t: 5000, seq: 2, type: "edit", file: "f1", version: 1, changes: [{ range: [1, 1, 1, 1], rangeLength: 0, text: "x" }], undo: false, flush: false },
    { t: 60000, seq: 3, type: "session_end", reason: "user" },
  ];
  const m = computeMetrics({ events, segments, meta: p.meta, ended_t: 60000 });
  assert.equal(m.silence_gt15s.length, 2); // 4s→31s, 34s→60s
  assert.equal(m.talking_point_hits.find((h) => h.id === "tp1")?.t, 1000);
  assert.equal(m.talking_point_hits.find((h) => h.id === "tp2")?.t, 31000);
  assert.equal(m.talking_point_hits.find((h) => h.id === "tp3")?.t, null);
  assert.ok(extractTerms("古いリクエストを AbortController で中断する").includes("AbortController"));
});
