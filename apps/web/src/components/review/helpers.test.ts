import { test } from "node:test";
import assert from "node:assert/strict";
import { tToMedia, mediaToT, sessionDuration, indexAtOrBefore, fmtTFine } from "./time.ts";
import { bucketEdits, densityOpacity, editWeight, xToT, tToX, maxBucketChars } from "./density.ts";
import { radarPoints, axisAngle, scoreRadius, gridPolygons, labelPosition, pointsAttr } from "./radar.ts";
import { sparkPath, sparkPoints } from "./sparkline.ts";
import type { Event, EventOf } from "@lci/core/browser";

// ---- time ----------------------------------------------------------------

test("t ↔ media は t_rec_start と scale で線形に写像される", () => {
  const rec = { t_rec_start: 1532, scale: 1.00005, media_duration_ms: 1185410 };
  assert.equal(tToMedia(1532, rec), 0);
  const t = 18743;
  const ms = tToMedia(t, rec);
  assert.ok(Math.abs(mediaToT(ms, rec) - t) < 1e-6);
  // 01 §5.3 の例: t_start = t_rec_start + start_ms * scale
  assert.ok(Math.abs(mediaToT(17210, rec) - (1532 + 17210 * 1.00005)) < 1e-6);
});

test("t → media は録画開始前は 0、録画長を超えたら末尾に丸める", () => {
  const rec = { t_rec_start: 1000, scale: 1, media_duration_ms: 5000 };
  assert.equal(tToMedia(0, rec), 0);
  assert.equal(tToMedia(99999, rec), 5000);
});

test("t_rec_start / scale が無い recorder は 0 / 1 とみなす", () => {
  assert.equal(tToMedia(2500, {}), 2500);
  assert.equal(mediaToT(2500, { scale: 0 }), 2500);
});

test("sessionDuration は ended_t・最終イベント・録画長の最大を取る", () => {
  assert.equal(sessionDuration({ ended_t: 10_000, lastEventT: 9_000 }), 10_000);
  assert.equal(sessionDuration({ lastEventT: 9_000, recorders: [{ t_rec_start: 500, scale: 1, media_duration_ms: 12_000 }] }), 12_500);
  assert.equal(sessionDuration({}), 1000);
});

test("indexAtOrBefore は二分探索で t 以下の最後の添字を返す", () => {
  const xs = [{ t: 0 }, { t: 10 }, { t: 20 }, { t: 30 }];
  const g = (x: { t: number }) => x.t;
  assert.equal(indexAtOrBefore(xs, -1, g), -1);
  assert.equal(indexAtOrBefore(xs, 0, g), 0);
  assert.equal(indexAtOrBefore(xs, 15, g), 1);
  assert.equal(indexAtOrBefore(xs, 30, g), 3);
  assert.equal(indexAtOrBefore(xs, 99, g), 3);
  assert.equal(indexAtOrBefore([], 5, g), -1);
});

test("fmtTFine は mm:ss.d", () => {
  assert.equal(fmtTFine(0), "00:00.0");
  assert.equal(fmtTFine(65_432), "01:05.4");
});

// ---- density -------------------------------------------------------------

const edit = (t: number, file: string, text: string, rangeLength = 0): EventOf<"edit"> => ({
  t,
  seq: t,
  type: "edit",
  file,
  version: 1,
  changes: [{ range: [1, 1, 1, 1], rangeLength, text }],
  undo: false,
  flush: false,
});

test("bucketEdits はファイル別レーンに文字数と回数を積む", () => {
  const events: Event[] = [
    { t: 0, seq: 0, type: "session_start" },
    edit(100, "f1", "abc"),
    edit(2600, "f1", "", 5),
    edit(9999, "f2", "x"),
  ];
  const lanes = bucketEdits(events, 10_000, 4, ["f1", "f2"]);
  assert.deepEqual(
    lanes.map((l) => l.file),
    ["f1", "f2"],
  );
  const f1 = lanes[0]!;
  assert.equal(f1.buckets.length, 4);
  assert.equal(f1.buckets[0]!.chars, 3);
  assert.equal(f1.buckets[0]!.edits, 1);
  assert.equal(f1.buckets[1]!.chars, 5);
  assert.equal(f1.total, 8);
  // 末尾ちょうどは最後のバケットに入る
  assert.equal(lanes[1]!.buckets[3]!.chars, 1);
  assert.equal(maxBucketChars(lanes), 5);
});

test("bucketEdits はファイル一覧に無いファイルも後ろに追加する", () => {
  const lanes = bucketEdits([edit(10, "zzz", "a")], 100, 2);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0]!.file, "zzz");
});

test("editWeight は削除＋挿入、空でも 1", () => {
  assert.equal(editWeight(edit(0, "f", "ab", 3)), 5);
  assert.equal(editWeight(edit(0, "f", "", 0)), 1);
});

test("densityOpacity は log スケールで 0.15..1", () => {
  assert.equal(densityOpacity(0, 100), 0);
  assert.equal(densityOpacity(100, 100), 1);
  const mid = densityOpacity(10, 100);
  assert.ok(mid > 0.15 && mid < 1);
  assert.ok(densityOpacity(1, 1_000_000) >= 0.15);
});

test("xToT / tToX は相互に逆写像で範囲内に収まる", () => {
  assert.equal(xToT(50, 100, 10_000), 5_000);
  assert.equal(tToX(5_000, 100, 10_000), 50);
  assert.equal(xToT(-5, 100, 10_000), 0);
  assert.equal(xToT(500, 100, 10_000), 10_000);
  assert.equal(xToT(10, 0, 10_000), 0);
});

// ---- radar ---------------------------------------------------------------

test("radarPoints: 軸 0 は真上、満点は半径 r", () => {
  const pts = radarPoints([5, 5, 5, 5, 5, 5, 5, 5], 100, 100, 50);
  assert.equal(pts.length, 8);
  assert.ok(Math.abs(pts[0]!.x - 100) < 1e-9);
  assert.ok(Math.abs(pts[0]!.y - 50) < 1e-9);
  // 軸 2（90°）は真右
  assert.ok(Math.abs(pts[2]!.x - 150) < 1e-9);
  assert.ok(Math.abs(pts[2]!.y - 100) < 1e-9);
});

test("scoreRadius は 0..5 を 0..r に、範囲外は丸める", () => {
  assert.equal(scoreRadius(0, 50), 0);
  assert.equal(scoreRadius(2.5, 50), 25);
  assert.equal(scoreRadius(9, 50), 50);
  assert.equal(scoreRadius(-1, 50), 0);
});

test("axisAngle は等間隔で時計回り", () => {
  const n = 8;
  for (let i = 1; i < n; i++) assert.ok(Math.abs(axisAngle(i, n) - axisAngle(i - 1, n) - Math.PI / 4) < 1e-12);
});

test("gridPolygons は levels 本の多角形を返し、pointsAttr は 'x,y' 列", () => {
  const g = gridPolygons(8, 0, 0, 40, 5);
  assert.equal(g.length, 5);
  assert.equal(g[0]!.split(" ").length, 8);
  assert.equal(pointsAttr([{ x: 1.234, y: 5.678 }]), "1.23,5.68");
});

test("labelPosition: 右側は start、左側は end、上下は middle", () => {
  assert.equal(labelPosition(0, 8, 0, 0, 40, 4).anchor, "middle");
  assert.equal(labelPosition(2, 8, 0, 0, 40, 4).anchor, "start");
  assert.equal(labelPosition(6, 8, 0, 0, 40, 4).anchor, "end");
});

// ---- sparkline -----------------------------------------------------------

test("sparkPath は欠損で線を切り、値域を高さに写す", () => {
  const o = { width: 100, height: 20, min: 1, max: 5, pad: 0 };
  const pts = sparkPoints([1, 5, null, 3], o);
  assert.deepEqual(pts[0], { x: 0, y: 20 });
  assert.deepEqual(pts[1], { x: 33.33, y: 0 });
  assert.equal(pts[2], null);
  assert.deepEqual(pts[3], { x: 100, y: 10 });
  assert.equal(sparkPath([1, 5, null, 3], o), "M0 20L33.33 0M100 10");
  // 1 点だけなら中央に置く
  assert.deepEqual(sparkPoints([3], o)[0], { x: 50, y: 10 });
});
