import test from "node:test";
import assert from "node:assert/strict";
import { convert } from "./units.ts";

test("glucose", () => {
  assert.equal(convert("glucose", 100, "mg/dL", "mmol/L"), 5.6);
  assert.equal(convert("glucose", 5.5, "mmol/L", "mg/dL"), 99);
  assert.equal(convert("glucose", 126, "mg/dL", "mmol/L"), 7.0);
});

test("creatinine", () => {
  assert.equal(convert("creatinine", 1.0, "mg/dL", "μmol/L"), 88);
  assert.equal(convert("creatinine", 80, "μmol/L", "mg/dL"), 0.9);
  assert.equal(convert("creatinine", 0.65, "mg/dL", "umol/L"), 57);
});

test("cholesterol", () => {
  assert.equal(convert("cholesterol", 200, "mg/dL", "mmol/L"), 5.17);
  assert.equal(convert("cholesterol", 5.0, "mmol/L", "mg/dL"), 193);
});

test("HbA1c is affine", () => {
  assert.equal(convert("hba1c", 6.5, "%", "mmol/mol"), 48);
  assert.equal(convert("hba1c", 53, "mmol/mol", "%"), 7.0);
  assert.equal(convert("hba1c", 2.15, "%", "mmol/mol"), 0);
  assert.equal(convert("hba1c", 0, "mmol/mol", "%"), 2.2);
});

test("body temperature is affine", () => {
  assert.equal(convert("body_temp", 37.0, "°C", "°F"), 98.6);
  assert.equal(convert("body_temp", 98.6, "°F", "°C"), 37.0);
  assert.equal(convert("body_temp", -40, "°C", "°F"), -40);
  assert.equal(convert("body_temp", 0, "°C", "°F"), 32);
});

test("unit variants", () => {
  assert.equal(convert("glucose", 100, "mg/dl", "MMOL/L"), 5.6);
  assert.equal(convert("glucose", 100, "ＭＧ／ＤＬ", " mmol / L "), 5.6);
  assert.equal(convert("creatinine", 1.0, "mg/dL", "µmol/L"), 88);
  assert.equal(convert("creatinine", 1.0, "mg/dL", "μmol/l"), 88);
  assert.equal(convert("body_temp", 37.0, "℃", "℉"), 98.6);
});

test("same unit only rounds", () => {
  assert.equal(convert("glucose", 99.6, "mg/dL", "mg/dl"), 100);
  assert.equal(convert("creatinine", 0.904, "mg/dL", "mg/dL"), 0.9);
});

test("round half up, not banker's rounding", () => {
  assert.equal(convert("glucose", 7.25, "mmol/L", "mg/dL"), 131);
  assert.equal(convert("glucose", 6.25, "mmol/L", "mg/dL"), 113);
  assert.equal(convert("glucose", 0.5, "mg/dL", "mg/dL"), 1);
  assert.equal(convert("glucose", 2.5, "mg/dL", "mg/dL"), 3);
});

test("negative values round half away from zero", () => {
  // Math.round(-0.25 * 10) は -2（+∞ 方向）になるので素朴な実装では -0.2 になる
  assert.equal(convert("body_temp", -0.25, "°C", "°C"), -0.3);
  assert.equal(convert("body_temp", -2.5, "°C", "°C"), -2.5);
});

test("unknown test, unit or value", () => {
  const bad: [string, unknown, string, string][] = [
    ["sodium", 140, "mEq/L", "mmol/L"],
    ["glucose", 100, "mg/dL", "g/L"],
    ["glucose", 100, "kg", "mmol/L"],
    ["hba1c", 6.5, "%", "mg/dL"],
    ["glucose", Number.NaN, "mg/dL", "mmol/L"],
    ["glucose", Number.POSITIVE_INFINITY, "mg/dL", "mmol/L"],
    ["glucose", "100", "mg/dL", "mmol/L"],
    ["toString", 1, "mg/dL", "mg/dL"],
  ];
  for (const [t, v, f, to] of bad) assert.throws(() => convert(t, v as number, f, to), JSON.stringify([t, v, f, to]));
});
