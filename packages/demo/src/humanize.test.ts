import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdit } from "@lci/core";
import { humanizeEdit, typingTokens, type Unit } from "./humanize.ts";
import { applyOp } from "./ops.ts";
import { graphemes } from "./text.ts";

/** 打鍵列を Monaco と同じ規則（変更前の文書に対する 1 始まりの範囲）で順に当てる */
function replay(doc: string, units: Unit[]): string {
  let cur = doc;
  for (const u of units) if ("change" in u) cur = applyEdit(cur, [u.change]);
  return cur;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function run(doc: string, old: string, neu: string, pace: "type" | "fast" | "instant" = "type") {
  const r = applyOp(doc, { op: "replace", old, new: neu, pace });
  assert.ok(r.ok, JSON.stringify(r));
  const h = humanizeEdit(doc, r.region, pace, null);
  assert.equal(h.text, r.text, "humanize の結果は操作の結果と同じ");
  assert.equal(replay(doc, h.units), r.text, "打鍵列を当てると操作の結果になる");
  return h;
}

test("日本語の挿入は 1 書記素ずつ打ち、共通部分は打ち直さない", () => {
  const doc = "# メモ: 未定\nprint(1)\n";
  const h = run(doc, "# メモ: 未定\n", "# メモ: 全探索は間に合わない\n");
  const typed = h.units.filter((u) => u.kind === "type").map((u) => (u as { change: { text: string } }).change.text);
  const dels = h.units.filter((u) => u.kind === "backspace").length;
  assert.equal(dels, 2, "「未定」の 2 字だけを消す");
  assert.equal(typed.join(""), "全探索は間に合わない");
  assert.ok(typed.every((t) => graphemes(t).length === 1));
});

test("サロゲートペア（絵文字）と結合文字の途中で切らない", () => {
  const h1 = run("x = '👍'\n", "'👍'", "'👍🎉👨‍👩‍👧'");
  for (const u of h1.units) if ("change" in u) assert.doesNotMatch(u.change.text, LONE_SURROGATE);
  const typed = h1.units.filter((u) => u.kind === "type").map((u) => (u as { change: { text: string } }).change.text);
  assert.deepEqual(typed, ["🎉", "👨‍👩‍👧"], "ZWJ 列は 1 書記素");

  // e + 結合アキュート → e + 結合サーカムフレックス: 共通の "e" で切ると結合文字だけが変わる。書記素ごと打ち直す
  const h2 = run("s = 'cafe\u0301'\n", "cafe\u0301", "cafe\u0302");
  const bs = h2.units.filter((u) => u.kind === "backspace");
  assert.equal(bs.length, 1);
  assert.equal((bs[0] as { change: { rangeLength: number } }).change.rangeLength, 2, "e と結合文字をまとめて消す");
  const t2 = h2.units.filter((u) => u.kind === "type").map((u) => (u as { change: { text: string } }).change.text);
  assert.deepEqual(t2, ["e\u0302"]);

  // 削除範囲にサロゲートペアを含む: Backspace 1 回で 1 書記素
  const h3 = run("a = '🍣🍺'\n", "'🍣🍺'", "''");
  assert.equal(h3.units.filter((u) => u.kind === "backspace").length, 2);
});

test("短い削除は Backspace、長い削除は範囲選択してから消す", () => {
  const short = run("    return 1\n", "return 1", "return 2");
  assert.deepEqual(
    short.units.map((u) => u.kind),
    ["jump", "backspace", "type"],
  );
  const long = run("a = 1\n# 消す行その1\n# 消す行その2\nb = 2\n", "# 消す行その1\n# 消す行その2\n", "");
  const kinds = long.units.map((u) => u.kind);
  assert.deepEqual(kinds, ["select", "delete"]);
  const sel = long.units[0] as { sel: [number, number, number, number] };
  assert.deepEqual(sel.sel, [2, 1, 4, 1]);
});

test("改行と直後のインデントは 1 単位（自動インデントの模倣）", () => {
  assert.deepEqual(typingTokens("if x:\n        y"), ["i", "f", " ", "x", ":", "\n        ", "y"]);
  const h = run("def f():\n    pass\n", "    pass\n", "    if x:\n        return 1\n    return 0\n");
  const nl = h.units.filter((u) => u.kind === "type" && u.newline);
  assert.ok(nl.length >= 2);
  assert.ok(nl.some((u) => (u as { change: { text: string } }).change.text === "\n        "));
});

test("pace=instant は塊ごと 1 回、fast は fast 印付き", () => {
  const i = run("a\nb\n", "b\n", "c\nd\n", "instant");
  assert.deepEqual(
    i.units.map((u) => u.kind),
    ["instant"],
  );
  const f = run("a\nb\n", "b\n", "cd\n", "fast");
  assert.ok(f.units.filter((u) => u.kind === "type").every((u) => (u as { fast: boolean }).fast));
});

test("離れた 2 か所の変更はカーソルを移動して別々に打つ", () => {
  const doc = "a = 1\nb = 2\nc = 3\nd = 4\n";
  const h = run(doc, doc, "a = 10\nb = 2\nc = 3\nd = 40\n");
  assert.equal(h.units.filter((u) => u.kind === "jump").length, 2);
  assert.equal(h.units.filter((u) => u.kind === "backspace").length, 0, "共通の接頭辞・接尾辞は消さない");
});

test("大きな write も速い（O(n) の位置計算）", () => {
  const big = Array.from({ length: 3000 }, (_, i) => `line_${i} = ${i} * 2  # コメント ${i}\n`).join("");
  const t0 = performance.now();
  const r = applyOp("", { op: "write", content: big, pace: "type" });
  assert.ok(r.ok);
  const h = humanizeEdit("", r.region, "type", null);
  assert.ok(performance.now() - t0 < 3000, `${performance.now() - t0}ms`);
  assert.equal(replay("", h.units), big);
});
