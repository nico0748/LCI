import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicates, type PatientRecord } from "./dedupe.ts";

const rec = (id: string, name_kana: string, birth_date: string, phone: string | null = null): PatientRecord => ({ id, name_kana, birth_date, phone });

test("kana variants merge", () => {
  const out = findDuplicates([
    rec("P001", "ヤマダ タロウ", "1990-01-02"),
    rec("P002", "やまだ　たろう", "1990-01-02"),
    rec("P003", "ﾔﾏﾀﾞ ﾀﾛｳ", "1990-01-02"),
    rec("P004", "ヤマダ・タロウ", "1990-01-02"),
  ]);
  assert.deepEqual(out, { merge: [["P001", "P002", "P003", "P004"]], review: [], invalid: [] });
});

test("date formats", () => {
  const out = findDuplicates([
    rec("A1", "サトウ ハナコ", "1985-03-04"),
    rec("A2", "サトウ ハナコ", "1985/3/4"),
    rec("A3", "サトウ ハナコ", "1985年3月4日"),
    rec("A4", "サトウ ハナコ", "１９８５／０３／０４"),
  ]);
  assert.deepEqual(out.merge, [["A1", "A2", "A3", "A4"]]);
});

test("different birth dates are not grouped", () => {
  assert.deepEqual(findDuplicates([rec("A1", "サトウ ハナコ", "1985-03-04"), rec("A2", "サトウ ハナコ", "1985-03-05")]), { merge: [], review: [], invalid: [] });
});

test("small kana and ヴ are distinct", () => {
  const out = findDuplicates([
    rec("B1", "ヤマダ ショウ", "2000-01-01"),
    rec("B2", "ヤマダ シヨウ", "2000-01-01"),
    rec("B3", "ヴィクター", "2000-01-01"),
    rec("B4", "ビクター", "2000-01-01"),
    rec("B5", "ゔぃくたー", "2000-01-01"),
  ]);
  assert.deepEqual(out.merge, [["B3", "B5"]]);
});

test("phone conflict goes to review", () => {
  const out = findDuplicates([rec("C1", "スズキ イチロウ", "1970-07-07", "090-1234-5678"), rec("C2", "すずき いちろう", "1970-07-07", "080-9999-0000")]);
  assert.deepEqual(out, { merge: [], review: [["C1", "C2"]], invalid: [] });
});

test("phone formats are the same number", () => {
  const out = findDuplicates([
    rec("D1", "タナカ ユイ", "1999-12-31", "090-1234-5678"),
    rec("D2", "タナカ ユイ", "1999-12-31", "０９０１２３４５６７８"),
    rec("D3", "タナカ ユイ", "1999-12-31", "(090) 1234 5678"),
  ]);
  assert.deepEqual(out.merge, [["D1", "D2", "D3"]]);
});

test("missing phone is not a conflict", () => {
  const out = findDuplicates([rec("E1", "イトウ ケン", "1980-02-29", "03-1111-2222"), rec("E2", "イトウ ケン", "1980-02-29", null), rec("E3", "イトウ ケン", "1980-02-29", "")]);
  assert.deepEqual(out.merge, [["E1", "E2", "E3"]]);
});

test("invalid records", () => {
  const out = findDuplicates([
    rec("F1", "ワタナベ", "1990-02-30"),
    rec("F2", "ワタナベ", ""),
    rec("F3", "ワタナベ", "H2.1.2"),
    rec("F4", "　 ", "1990-01-01"),
    rec("F5", "ワタナベ", "2023-02-29"),
    rec("F6", "ワタナベ", "1990-1-2"),
  ]);
  assert.deepEqual(out, { merge: [], review: [], invalid: ["F1", "F2", "F3", "F4", "F5", "F6"] });
});

test("singletons are not reported", () => assert.deepEqual(findDuplicates([rec("G1", "コバヤシ", "2001-01-01")]), { merge: [], review: [], invalid: [] }));

test("order is deterministic", () => {
  const rows = [
    rec("Z9", "ナカムラ", "1990-01-01"),
    rec("A5", "ナカムラ", "1990-01-01"),
    rec("M3", "キムラ", "1990-01-01", "1"),
    rec("B2", "キムラ", "1990-01-01", "2"),
    rec("C7", "ハヤシ", "1990-01-01"),
    rec("C1", "ハヤシ", "1990-01-01"),
    rec("X1", "", "1990-01-01"),
    rec("Q1", "ハヤシ", "bad"),
  ];
  const expected = { merge: [["A5", "Z9"], ["C1", "C7"]], review: [["B2", "M3"]], invalid: ["Q1", "X1"] };
  assert.deepEqual(findDuplicates(rows), expected);
  assert.deepEqual(findDuplicates([...rows].reverse()), expected);
  assert.deepEqual(findDuplicates([rows[3]!, rows[6]!, rows[0]!, rows[5]!, rows[2]!, rows[7]!, rows[1]!, rows[4]!]), expected);
});

test("many records", () => {
  const rows = Array.from({ length: 10000 }, (_, i) => rec(`R${String(i).padStart(5, "0")}`, `カナ${i % 5000}`, "1990-01-01"));
  const out = findDuplicates(rows);
  assert.equal(out.merge.length, 5000);
  assert.deepEqual(out.merge[0], ["R00000", "R05000"]);
});
