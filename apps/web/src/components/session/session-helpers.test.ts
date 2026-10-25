import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PANE_RATIOS, PANE_MIN, RAIL_WIDTH, parsePaneRatios, resizePane, resolvePaneWidths } from "./pane-layout.ts";
import { formatClock, remainingSentence, timerAnnouncement, timerView } from "./timer.ts";
import { recLabel, recState, stoppedMessage } from "./recording-state.ts";
import { VOICE_SEGMENT, levelSegments, rmsToDb, trackSilence } from "./meter.ts";
import { chordAction, shortcut } from "./keys.ts";
import { judgeLine, runHeadline, sessionClock } from "./run-view.ts";
import type { RecorderStatus } from "../../lib/capture/recorder.ts";

test("resolvePaneWidths: 1440px の web は約 346 / 634 / 460（03 §3.2。丸めで ±1）", () => {
  const w = resolvePaneWidths(1440, DEFAULT_PANE_RATIOS.web, true);
  assert.deepEqual(w, { problem: 346, right: 461, editor: 633 });
  assert.equal(w.problem + w.editor + w.right, 1440);
});

test("resolvePaneWidths: 狭いときは右 → 問題の順に最小幅まで削り、エディタ 480 を守る", () => {
  const w = resolvePaneWidths(1100, { problem: 0.3, right: 0.4 }, true);
  assert.equal(w.editor, 1100 - w.problem - w.right);
  assert.ok(w.editor >= PANE_MIN.editor);
  assert.ok(w.right >= PANE_MIN.right && w.problem >= PANE_MIN.problem);
  // 最小幅の合計（1000）未満ではエディタが残りを使う
  const tiny = resolvePaneWidths(900, DEFAULT_PANE_RATIOS.code, true);
  assert.deepEqual(tiny, { problem: PANE_MIN.problem, right: PANE_MIN.right, editor: 380 });
});

test("resolvePaneWidths: 畳んだ問題ペインは 32px のレール", () => {
  const w = resolvePaneWidths(1440, DEFAULT_PANE_RATIOS.code, false);
  assert.equal(w.problem, RAIL_WIDTH);
  assert.equal(w.problem + w.editor + w.right, 1440);
});

test("resizePane: 最小幅とエディタの最小幅で止まる", () => {
  const r = DEFAULT_PANE_RATIOS.web;
  assert.equal(resolvePaneWidths(1440, resizePane(1440, r, true, "problem", 100), true).problem, PANE_MIN.problem);
  const big = resolvePaneWidths(1440, resizePane(1440, r, true, "right", 2000), true);
  assert.equal(big.editor, PANE_MIN.editor);
  assert.equal(resolvePaneWidths(1440, resizePane(1440, r, true, "problem", 400), true).problem, 400);
});

test("parsePaneRatios: 壊れた値・範囲外は既定値", () => {
  assert.deepEqual(parsePaneRatios(null, "web"), DEFAULT_PANE_RATIOS.web);
  assert.deepEqual(parsePaneRatios("{", "code"), DEFAULT_PANE_RATIOS.code);
  assert.deepEqual(parsePaneRatios('{"problem":0.5,"right":0.5}', "code"), DEFAULT_PANE_RATIOS.code);
  assert.deepEqual(parsePaneRatios('{"problem":0.2,"right":0.3}', "code"), { problem: 0.2, right: 0.3 });
});

test("timerView: 5 分前までは分単位・切り上げ、5 分からは秒表示で warn（X4）", () => {
  const limit = 20 * 60_000;
  assert.deepEqual(timerView(19 * 60_000 + 1, limit, "remaining"), { label: "残り", value: "20 分", warn: false, spoken: "残り 20 分" });
  assert.equal(timerView(5 * 60_000 + 1, limit, "remaining").value, "6 分");
  const w = timerView(5 * 60_000, limit, "remaining");
  assert.equal(w.value, "5:00");
  assert.equal(w.warn, true);
  assert.equal(timerView(4 * 60_000 + 59_001, limit, "remaining").value, "5:00");
  assert.equal(timerView(-10, limit, "remaining").value, "0:00");
  // 経過表示: 切り捨て。残り 5 分を切ったら残りに戻す
  assert.equal(timerView(limit - 42_000, limit, "elapsed").value, "0 分");
  assert.equal(timerView(limit - 13 * 60_000, limit, "elapsed").value, "13 分");
  assert.equal(timerView(4 * 60_000, limit, "elapsed").label, "残り");
});

test("timerAnnouncement: 5 分・1 分を跨いだときだけ", () => {
  assert.equal(timerAnnouncement(300_100, 299_900), "残り 5 分です");
  assert.equal(timerAnnouncement(299_900, 299_700), null);
  assert.equal(timerAnnouncement(60_100, 59_900), "残り 1 分です");
  assert.equal(timerAnnouncement(1000, 0), null);
});

test("formatClock / remainingSentence / sessionClock", () => {
  assert.equal(formatClock(61_000), "1:01");
  assert.equal(remainingSentence(7 * 60_000 + 12_000), "残り 7 分 12 秒あります。");
  assert.equal(remainingSentence(30_000), "残り 30 秒あります。");
  assert.equal(remainingSentence(0), null);
  assert.equal(sessionClock(754_900), "12:34");
});

const st = (id: "cam" | "screen", state: RecorderStatus["state"]): RecorderStatus => ({ id, state, chunks: 0, bytes: 0, pendingUploads: 0, uploadFailures: 0 });

test("recState: 録画なし / 準備中 / 録画中 / 停止（一部停止）", () => {
  assert.deepEqual(recState({ enabled: false, statuses: [], camUnavailable: false, silent: false }), { kind: "off" });
  assert.deepEqual(recState({ enabled: true, statuses: [], camUnavailable: false, silent: false }), { kind: "starting" });
  assert.deepEqual(recState({ enabled: true, statuses: [st("cam", "recording")], camUnavailable: false, silent: true }), { kind: "recording", silent: true });
  assert.deepEqual(recState({ enabled: true, statuses: [st("cam", "stopped")], camUnavailable: false, silent: false }), { kind: "stopped", recorders: ["cam"], partial: false });
  assert.deepEqual(recState({ enabled: true, statuses: [st("cam", "recording"), st("screen", "error")], camUnavailable: false, silent: false }), {
    kind: "stopped",
    recorders: ["screen"],
    partial: true,
  });
  assert.deepEqual(recState({ enabled: true, statuses: [], camUnavailable: true, silent: false }), { kind: "stopped", recorders: ["cam"], partial: false });
});

test("stoppedMessage / recLabel: マイクのみは「録音」と呼ぶ", () => {
  assert.equal(stoppedMessage(["cam"], true, "track_ended").title, "カメラとマイクの録画が止まっています");
  assert.equal(stoppedMessage(["cam"], false, null).title, "マイクの録音が止まっています");
  assert.equal(stoppedMessage(["screen"], true, null).title, "画面録画が止まっています");
  assert.match(stoppedMessage(["cam"], true, "track_ended").detail, /^（デバイスが切断.*編集ログは記録を続けています。$/);
  assert.equal(recLabel({ kind: "recording", silent: false }, false), "録音中");
  assert.equal(recLabel({ kind: "stopped", recorders: ["screen"], partial: true }, true), "一部停止");
});

test("levelSegments: -60 dB 以下は 0、-10 dB 以上は 12、目安線は -40 dB", () => {
  assert.equal(levelSegments(0), 0);
  assert.equal(levelSegments(0.001), 0);
  assert.equal(levelSegments(1), 12);
  assert.equal(levelSegments(0.01), VOICE_SEGMENT);
  assert.ok(Math.abs(rmsToDb(0.1) + 20) < 1e-9);
});

test("trackSilence: -50 dB 未満が 10 秒続いたら silent、音が入ったらリセット", () => {
  let s = trackSilence({ since: null }, 0.0001, 1000);
  assert.deepEqual(s, { since: 1000, silent: false });
  s = trackSilence(s, 0.0001, 10_999);
  assert.equal(s.silent, false);
  s = trackSilence(s, 0.0001, 11_000);
  assert.equal(s.silent, true);
  assert.deepEqual(trackSilence(s, 0.05, 11_500), { since: null, silent: false });
});

test("shortcut / chordAction: 修飾キーは OS ごと、⌘K の後のキー", () => {
  assert.deepEqual(shortcut("run", "mac"), { kbd: "⌘↵", aria: "Meta+Enter" });
  assert.deepEqual(shortcut("judge", "other"), { kbd: "Ctrl+Shift+↵", aria: "Control+Shift+Enter" });
  assert.equal(chordAction("2"), "focus-editor");
  assert.equal(chordAction("ArrowRight"), "next-file");
  assert.equal(chordAction("?"), "help");
  assert.equal(chordAction("x"), null);
});

test("runHeadline / judgeLine: 終了コードは 0 以外だけ、判定は件数だけ", () => {
  assert.deepEqual(runHeadline({ verdict: "AC", exit_code: 0, duration_ms: 120.4 }), { tone: "success", label: "正常終了", meta: "120ms" });
  assert.equal(runHeadline({ verdict: "RE", exit_code: 1, duration_ms: 5 }).meta, "終了コード 1 · 5ms");
  assert.deepEqual(judgeLine(754_000, 3, 5), { main: "判定 12:34　サンプル 3 / 5 通過", note: "詳細は振り返りで" });
});
