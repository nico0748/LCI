import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTabIndex } from "./tabs-keys.ts";
import { cx } from "./cx.ts";

test("nextTabIndex: 矢印は端で止まり、Home/End で端へ、対象外のキーは null（DADS useTabAria と同じ）", () => {
  assert.equal(nextTabIndex("ArrowRight", 0, 3), 1);
  assert.equal(nextTabIndex("ArrowRight", 2, 3), 2);
  assert.equal(nextTabIndex("ArrowLeft", 0, 3), 0);
  assert.equal(nextTabIndex("ArrowLeft", 2, 3), 1);
  assert.equal(nextTabIndex("Home", 2, 3), 0);
  assert.equal(nextTabIndex("End", 0, 3), 2);
  assert.equal(nextTabIndex("ArrowDown", 0, 3), null);
  assert.equal(nextTabIndex("ArrowDown", 0, 3, "vertical"), 1);
  assert.equal(nextTabIndex("a", 0, 3), null);
  assert.equal(nextTabIndex("ArrowRight", 0, 0), null);
});

test("cx: falsy を捨てて空白でつなぐ", () => {
  assert.equal(cx("a", false, null, undefined, "", "b"), "a b");
});

test("evalLevelOf: core の severity / RequirementStatus を 3 値に写す（X1）", async () => {
  const { evalLevelOf, EVAL_LABEL } = await import("./eval-level.ts");
  assert.equal(evalLevelOf("major"), "major");
  assert.equal(evalLevelOf("missing"), "major");
  assert.equal(evalLevelOf("minor"), "minor");
  assert.equal(evalLevelOf("mentioned_only"), "minor");
  assert.equal(evalLevelOf("positive"), "good");
  assert.equal(evalLevelOf("implemented"), "good");
  assert.equal(evalLevelOf("unknown"), null);
  assert.equal(EVAL_LABEL.requirement.minor, "言及のみ");
});
