import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DemoDraft } from "./schema.ts";
import { buildReading, needsReading, sanitizeForSay, unreadableParts } from "./readings.ts";
import { checkStructure, lintNarration } from "./checks.ts";
import { applyOp } from "./ops.ts";
import { graphemes, numberLines, occurrences, posAt, splitSentences } from "./text.ts";
import type { ProblemMeta } from "@lci/core";

const FIXTURE = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/alg-0001-python.draft.json"), "utf8"));

test("text: 書記素・位置（UTF-16 の列）・行番号・文の分割", () => {
  assert.deepEqual(graphemes("a👍é👨‍👩‍👧"), ["a", "👍", "é", "👨‍👩‍👧"]);
  assert.deepEqual(posAt("ab\n👍c", 5), [2, 3], "列は UTF-16 単位（Monaco と同じ）");
  assert.equal(numberLines("a\nb"), "   1| a\n   2| b");
  assert.deepEqual(occurrences("aaa", "aa"), [0, 1], "重なりも数える（一意判定のため）");
  assert.deepEqual(splitSentences("一つ目。二つ目！three? 四"), ["一つ目。", "二つ目！", "three?", "四"]);
});

test("ops: append / write / replace の no-op", () => {
  const a = applyOp("x\n", { op: "append", text: "y\r\n", pace: "type" });
  assert.ok(a.ok && a.text === "x\ny\n", "改行は LF に正規化");
  const w = applyOp("x\n", { op: "write", content: "x\n", pace: "type" });
  assert.ok(!w.ok && w.error.code === "E_OP_NOOP");
  const r = applyOp("x = 1\n", { op: "replace", old: "x = 1", new: "x = 1", pace: "type" });
  assert.ok(!r.ok && r.error.code === "E_OP_NOOP");
});

test("readings: 計算量・数式・識別子をカナに、say に渡せない文字は落とす", () => {
  assert.equal(buildReading("全探索は O(N^2) です。", undefined), "全探索は オーダー エヌ にじょう です。");
  assert.equal(buildReading("N=2×10^5 なので", undefined), "エヌ イコール 2 かける 10 の 5 じょう なので");
  assert.equal(buildReading("`seen` に `k - x` を引きます", undefined, [{ term: "seen", reading: "シーン" }]), "シーン に ケー マイナス エックス を引きます");
  assert.equal(buildReading("無視される text", "よみ"), "よみ", "reading があればそれを使う");
  assert.match(sanitizeForSay("[[x]] a\u0000b"), /^x a ?b$/);
  assert.doesNotMatch(sanitizeForSay("[[危険]]\u0007です"), /\[\[|\u0007/);
  assert.ok(sanitizeForSay("あ".repeat(2000)).length <= 640);
  assert.equal(needsReading("ハッシュで引きます"), false);
  assert.equal(needsReading("seenFoo で引きます"), true);
  assert.deepEqual(unreadableParts(buildReading("weirdName を使う", undefined)), ["weirdName"]);
});

test("lintNarration: 字幕 60 字超の文、書式、読みの無い英字", () => {
  const d = DemoDraft.parse(FIXTURE);
  assert.deepEqual(lintNarration(d).errors, []);
  const bad = structuredClone(FIXTURE);
  bad.steps[0].say.text = `${"あ".repeat(61)}。`;
  bad.steps[1].say.text = "**強調** は使えません。";
  bad.steps[2].say = { text: "fooBarBaz を使います。" };
  const r = lintNarration(DemoDraft.parse(bad));
  const codes = [...r.errors, ...r.warnings].map((e) => `${e.code}:${e.step_id}`);
  assert.ok(codes.includes(`E_SENTENCE_LONG:${bad.steps[0].id}`), codes.join());
  assert.ok(codes.some((c) => c.endsWith(`:${bad.steps[1].id}`) && c.startsWith("E_")), codes.join());
  assert.ok(codes.includes(`W_READING_MISSING:${bad.steps[2].id}`), codes.join());
});

test("checkStructure: 章の順序・寄り道の回数・未知の covers", () => {
  const meta = {
    talking_points: [{ id: "tp1", text: "x", weight: 1 }],
    requirements: [],
    rubric_hints: { red_flags: [], time_management: "" },
    interviewer_mode: "silent",
  } as unknown as ProblemMeta;
  const base = {
    title: "t",
    summary: "s",
    chapters: [
      { id: "req", title: "要件", phase: "requirements" },
      { id: "impl", title: "実装", phase: "implement" },
      { id: "plan", title: "方針", phase: "plan" },
      { id: "rev", title: "見直し", phase: "review" },
    ],
    steps: [
      { id: "s1", chapter: "req", say: { text: "要件です。" }, covers: ["tp1", "tp9"] },
      { id: "s2", chapter: "impl", say: { text: "実装です。" } },
      { id: "s3", chapter: "plan", say: { text: "方針です。" } },
      { id: "s4", chapter: "rev", say: { text: "見直しです。" } },
    ],
    self_check: "",
  };
  const r = checkStructure(DemoDraft.parse(base), { meta, judgeKind: "stdio" });
  const codes = r.errors.map((e) => e.code);
  assert.ok(r.warnings.some((w) => w.code === "W_UNKNOWN_COVER" && w.step_id === "s1"), "tp9 は無い id");
  assert.ok(r.errors.some((e) => e.code === "E_PHASE_ORDER" && /implement/.test(e.message)), `plan より前に implement: ${codes.join()}`);
  assert.ok(r.errors.some((e) => e.code === "E_PHASE_MISSING" && /test/.test(e.message)), `検証の章が無い: ${codes.join()}`);

  const detours = structuredClone(base) as typeof base;
  detours.chapters = [
    { id: "req", title: "要件", phase: "requirements" },
    { id: "plan", title: "方針", phase: "plan" },
    { id: "impl", title: "実装", phase: "implement" },
    { id: "d1", title: "寄り道1", phase: "detour" },
    { id: "d2", title: "寄り道2", phase: "detour" },
    { id: "rev", title: "見直し", phase: "review" },
  ];
  detours.steps = detours.chapters.map((c, i) => ({ id: `s${i}`, chapter: c.id, say: { text: "はい。" } })) as typeof base.steps;
  const r2 = checkStructure(DemoDraft.parse(detours), { meta, judgeKind: "stdio" });
  assert.ok(r2.errors.some((e) => e.code === "E_DETOUR_COUNT"));
});
