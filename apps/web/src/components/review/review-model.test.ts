import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evaluation, FeedbackItem, Metrics } from "@lci/core/browser";
import { editLevel, editLevelBounds, bucketCountFor, tickStepFor, tickTimes, stackRows, needsReveal, shortcutAllowed, type KeyTarget } from "./timeline-layout.ts";
import {
  axisRows,
  describeEvidence,
  dotBarX,
  evidenceSeekable,
  fmtDuration,
  fmtRange,
  isSpeculative,
  metricLabel,
  metricTiles,
  numberFeedback,
  requirementCounts,
  requirementLabel,
} from "./review-model.ts";
import { feedbackPins, nextPin, prevPin } from "./pins.ts";

// ---- timeline-layout -----------------------------------------------------

test("editLevel は log で 4 段に量子化し、0 は編集なし", () => {
  assert.equal(editLevel(0, 100), 0);
  assert.equal(editLevel(5, 0), 0);
  assert.equal(editLevel(100, 100), 4);
  assert.equal(editLevel(1, 100_000), 1);
  const levels = [1, 3, 10, 30, 100, 300, 1000].map((c) => editLevel(c, 1000));
  // 単調非減少
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i]! >= levels[i - 1]!);
  assert.equal(levels[levels.length - 1], 4);
});

test("editLevelBounds は段の上限を昇順で返し、最上段は max", () => {
  const b = editLevelBounds(1000);
  assert.equal(b.length, 4);
  assert.equal(b[3], 1000);
  for (let i = 1; i < 4; i++) assert.ok(b[i]! > b[i - 1]!);
  // 上限ちょうどはその段に入る
  for (let i = 0; i < 4; i++) assert.equal(editLevel(b[i]!, 1000), i + 1);
  assert.deepEqual(editLevelBounds(0), [0, 0, 0, 0]);
});

test("bucketCountFor は 1 本 6px 以上になる本数を 12..240 に収める", () => {
  assert.equal(bucketCountFor(600), 100);
  assert.equal(bucketCountFor(30), 12);
  assert.equal(bucketCountFor(5000), 240);
});

test("tickStepFor はラベル間隔が minGap 以上になる最小の刻み", () => {
  // 10 分を 1100px: 30 秒 = 55px < 64 → 60 秒 = 110px
  assert.equal(tickStepFor(600_000, 1100), 60_000);
  // 10 分を 300px: 60 秒 = 30px, 120 秒 = 60px, 300 秒 = 150px
  assert.equal(tickStepFor(600_000, 300), 300_000);
  assert.deepEqual(tickTimes(600_000, 300_000), [0, 300_000, 600_000]);
  assert.deepEqual(tickTimes(100, 0), []);
});

test("stackRows は近いピンを次の段に逃がし、段が尽きたら最も左が古い段に重ねる", () => {
  assert.deepEqual(stackRows([0, 100, 200], 24), [0, 0, 0]);
  assert.deepEqual(stackRows([0, 10, 50], 24), [0, 1, 0]);
  // 入力順は x 順でなくてよい
  assert.deepEqual(stackRows([10, 0], 24), [1, 0]);
  const r = stackRows([0, 5, 10], 24, 2);
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x === 0 || x === 1));
});

test("needsReveal は上端が画面上部に無い、または下端が画面の 6 割に届かないとき true", () => {
  assert.equal(needsReveal({ top: 0, bottom: 800 }, 900), false);
  assert.equal(needsReveal({ top: 800, bottom: 1600 }, 900), true);
  assert.equal(needsReveal({ top: -600, bottom: 200 }, 900), true);
  // モバイル: sticky のプレイヤーが残る位置（上端は画面外、下端は画面より下）
  assert.equal(needsReveal({ top: -1200, bottom: 1500 }, 844), false);
});

const target = (over: Partial<KeyTarget>): KeyTarget => ({ tag: "DIV", role: null, editable: false, inEditor: false, inArrowWidget: false, ...over });

test("shortcutAllowed: Space はボタン・リンク・summary・タブ・スライダーでは奪わない（S2-5）", () => {
  assert.equal(shortcutAllowed(" ", target({}), false), true);
  assert.equal(shortcutAllowed(" ", target({ tag: "BUTTON" }), false), false);
  assert.equal(shortcutAllowed(" ", target({ tag: "A" }), false), false);
  assert.equal(shortcutAllowed(" ", target({ tag: "SUMMARY" }), false), false);
  assert.equal(shortcutAllowed(" ", target({ role: "tab" }), false), false);
  assert.equal(shortcutAllowed(" ", target({ role: "slider" }), false), false);
});

test("shortcutAllowed: 矢印は toolbar・tablist・slider の中では部品に任せる。入力欄・エディタ・修飾キーでは全部止める", () => {
  assert.equal(shortcutAllowed("ArrowLeft", target({ tag: "BUTTON" }), false), true);
  assert.equal(shortcutAllowed("ArrowRight", target({ inArrowWidget: true }), false), false);
  assert.equal(shortcutAllowed("j", target({ tag: "BUTTON" }), false), true);
  assert.equal(shortcutAllowed("j", target({ tag: "INPUT" }), false), false);
  assert.equal(shortcutAllowed("k", target({ editable: true }), false), false);
  assert.equal(shortcutAllowed("ArrowLeft", target({ inEditor: true }), false), false);
  assert.equal(shortcutAllowed("ArrowLeft", target({}), true), false);
  assert.equal(shortcutAllowed("x", target({}), false), false);
});

// ---- review-model --------------------------------------------------------

const fb = (id: string, t: number, severity: FeedbackItem["severity"], extra: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id,
  t,
  axis: "R7_sync",
  severity,
  kind: "gap",
  title: id,
  detail: "",
  evidence: [],
  speculative: false,
  ...extra,
});

test("numberFeedback は時刻順に 1 から振り、同時刻は id 順", () => {
  const n = numberFeedback([fb("f1", 26_000, "major"), fb("f3", 3_000, "positive"), fb("f0", 26_000, "minor")]);
  assert.equal(n.get("f3"), 1);
  assert.equal(n.get("f0"), 2);
  assert.equal(n.get("f1"), 3);
});

test("feedbackPins は番号と範囲（t_end > t のときだけ）を持つ", () => {
  const ev = { feedback: [fb("a", 1000, "major", { t_end: 5000 }), fb("b", 2000, "minor", { t_end: 2000 })] } as unknown as Evaluation;
  const pins = feedbackPins(ev, numberFeedback(ev.feedback));
  assert.equal(pins[0]!.n, 1);
  assert.equal(pins[0]!.tEnd, 5000);
  assert.equal(pins[1]!.tEnd, undefined);
  assert.equal(nextPin(pins, 1000)!.id, "b");
  assert.equal(prevPin(pins, 2000)!.id, "a");
});

test("fmtRange / fmtDuration", () => {
  assert.equal(fmtRange(60_000, 200_000), "01:00–03:20");
  assert.equal(fmtRange(60_000, 60_000), "01:00");
  assert.equal(fmtDuration(140_000), "2 分 20 秒");
  assert.equal(fmtDuration(45_000), "45 秒");
  assert.equal(fmtDuration(120_000), "2 分");
});

test("describeEvidence は種類と時刻を分けて返す。指標名は日本語にする", () => {
  assert.deepEqual(describeEvidence({ type: "transcript", t0: 3000, t1: 9000, quote: "あ" }), { kind: "発話", text: "「あ」", t: 3000 });
  assert.equal(describeEvidence({ type: "metric", name: "silence_gt15s", index: 0 }).text, "15 秒超の沈黙 #1");
  assert.equal(describeEvidence({ type: "edit_absence", symbol: "AbortController" }).t, null);
  assert.equal(metricLabel("metrics.run_events"), "実行");
  assert.equal(metricLabel("unknown_x"), "unknown_x");
});

const metrics = {
  metrics_version: "1",
  duration_s: 600,
  speech_total_s: 230,
  speech_ratio: 0.38,
  edit_total_events: 36,
  lead_time_s: { median: 8, p25: 4, p75: 15, samples: 6 },
  silence_gt15s: [
    { t0: 60_000, t1: 200_000, dur_s: 140, editing: true },
    { t0: 410_000, t1: 600_000, dur_s: 190, editing: false },
  ],
  silent_edit_ratio: 0.31,
  direction_changes: [],
  run_events: [{ t: 400_000, mode: "run", verdict: "AC" }],
  phase_estimate: [
    { phase: "design", t0: 0, t1: 20_000 },
    { phase: "implement", t0: 20_000, t1: 390_000 },
  ],
  talking_point_hits: [],
  restatements: 0,
  filler_rate: 0,
  paste_events: 0,
  visibility_hidden_s: 0,
} as Metrics;

test("evidenceSeekable: 指標は該当する区間があるときだけ移動できる", () => {
  assert.equal(evidenceSeekable({ type: "metric", name: "silence_gt15s", index: 1 }, metrics), true);
  assert.equal(evidenceSeekable({ type: "metric", name: "silence_gt15s", index: 5 }, metrics), false);
  assert.equal(evidenceSeekable({ type: "metric", name: "phase_estimate" }, metrics), false);
  assert.equal(evidenceSeekable({ type: "edit_absence", symbol: "x" }, metrics), false);
  assert.equal(evidenceSeekable({ type: "metric", name: "run_events" }, null), false);
});

test("metricTiles は基準を持ち、沈黙を手が止まった/書きながらに分ける", () => {
  const tiles = metricTiles(metrics);
  const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
  assert.equal(byId.silent_edit_ratio!.value, "31%");
  assert.match(byId.silent_edit_ratio!.benchmark!, /20%/);
  assert.equal(byId.silence!.detail, "手が止まった 1 回 · 書きながら 1 回");
  assert.equal(byId.run_events!.value, "1 回");
  assert.equal(byId.design!.value, "20 秒");
  assert.equal(byId.lead_time_s!.value, "8.0 秒");
});

test("dotBarX は 1..5 を両端の余白の内側に写し、範囲外は丸める", () => {
  assert.equal(dotBarX(1, 100, 10), 10);
  assert.equal(dotBarX(5, 100, 10), 90);
  assert.equal(dotBarX(3, 100, 10), 50);
  assert.equal(dotBarX(9, 100, 10), 90);
});

test("axisRows は AXES の固定順で重みと次の練習の対象を返す", () => {
  const s = (score: number, confidence = 0.8) => ({ score, confidence, rationale: "", evidence: [{ type: "frame" as const, t: 0 }] });
  const ev = {
    scores: { R1_requirements: s(4), R2_plan: s(3), R3_tradeoffs: s(3, 0.5), R4_correctness: s(4), R5_testing: s(2), R6_time: s(4), R7_sync: s(3), R8_attitude: s(4), overall: 3.4 },
    next_practice: [{ axis: "R5_testing", action: "", based_on: [] }],
  } as unknown as Evaluation;
  const rows = axisRows(ev);
  assert.equal(rows.length, 8);
  assert.equal(rows[0]!.id, "R1_requirements");
  assert.equal(rows[3]!.weightPct, 20);
  assert.equal(rows.reduce((a, r) => a + r.weightPct, 0), 100);
  assert.equal(rows[4]!.practice, true);
  assert.equal(rows[0]!.practice, false);
  assert.equal(rows[2]!.speculative, true);
});

test("isSpeculative: 明示・低確信度・根拠なしのいずれかで推測", () => {
  assert.equal(isSpeculative({ speculative: true }), true);
  assert.equal(isSpeculative({ confidence: 0.59, evidence: [1] }), true);
  assert.equal(isSpeculative({ confidence: 0.9, evidence: [] }), true);
  assert.equal(isSpeculative({ confidence: 0.9, evidence: [1] }), false);
});

test("requirementCounts / requirementLabel", () => {
  const list = [
    { id: "a", label: "A", status: "implemented" as const },
    { id: "b", label: "B", status: "mentioned_only" as const },
    { id: "c", label: "C", status: "missing" as const },
    { id: "d", label: "D", status: "implemented" as const },
  ];
  assert.deepEqual(requirementCounts(list), { implemented: 2, mentioned: 1, missing: 1, total: 4 });
  const ev = { requirement_checklist: list } as unknown as Evaluation;
  assert.equal(requirementLabel("b", ev, []), "B");
  assert.equal(requirementLabel("z", ev, [{ id: "z", label: "Z 要件" }]), "Z 要件");
  assert.equal(requirementLabel("q", null, undefined), "q");
});
