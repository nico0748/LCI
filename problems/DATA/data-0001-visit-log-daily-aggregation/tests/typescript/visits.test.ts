import test from "node:test";
import assert from "node:assert/strict";
import { aggregateVisits } from "./visits.ts";

const HEADER = "visit_id,patient_id,department,visited_at";
const csv = (lines: string[], header = HEADER, nl = "\n") => [header, ...lines].join(nl) + nl;

test("JST day boundary", () => {
  const out = aggregateVisits(csv(["v1,p1,内科,2026-03-31T14:59:59Z", "v2,p2,内科,2026-03-31T15:00:00Z"]));
  assert.deepEqual(out.rows, [
    { date: "2026-03-31", department: "内科", visits: 1, patients: 1 },
    { date: "2026-04-01", department: "内科", visits: 1, patients: 1 },
  ]);
  assert.deepEqual(out.errors, []);
});

test("mixed offsets", () => {
  const out = aggregateVisits(
    csv([
      "v1,p1,内科,2026-04-01T08:30:00+09:00",
      "v2,p2,内科,2026-03-31T20:00:00-05:00",
      "v3,p3,内科,2026-03-31T23:30:00+00:00",
      "v4,p4,内科,2026-04-01T23:59:59+09:00",
      "v5,p5,内科,2026-04-01T15:00:00Z",
    ]),
  );
  assert.deepEqual(out.rows, [
    { date: "2026-04-01", department: "内科", visits: 4, patients: 4 },
    { date: "2026-04-02", department: "内科", visits: 1, patients: 1 },
  ]);
});

test("visits and unique patients", () => {
  const out = aggregateVisits(
    csv([
      "v1,p1,内科,2026-04-01T09:00:00+09:00",
      "v2,p1,内科,2026-04-01T13:00:00+09:00",
      "v3,p2,内科,2026-04-01T10:00:00+09:00",
      "v4,p1,外科,2026-04-01T11:00:00+09:00",
    ]),
  );
  assert.deepEqual(out.rows, [
    { date: "2026-04-01", department: "内科", visits: 3, patients: 2 },
    { date: "2026-04-01", department: "外科", visits: 1, patients: 1 },
  ]);
});

test("order by date then department", () => {
  const out = aggregateVisits(
    csv(["v1,p1,小児科,2026-04-02T09:00:00+09:00", "v2,p1,内科,2026-04-02T09:00:00+09:00", "v3,p1,皮膚科,2026-04-01T09:00:00+09:00"]),
  );
  assert.deepEqual(
    out.rows.map((r) => [r.date, r.department]),
    [
      ["2026-04-01", "皮膚科"],
      ["2026-04-02", "内科"],
      ["2026-04-02", "小児科"],
    ],
  );
});

test("quoted field with a comma and an escaped quote", () => {
  const out = aggregateVisits(csv(['v1,p1,"小児科（夜間, 休日）",2026-04-01T10:00:00+09:00', 'v2,p2,"眼科 ""第2""",2026-04-01T10:00:00+09:00']));
  assert.deepEqual(
    out.rows.map((r) => r.department),
    ["小児科（夜間, 休日）", '眼科 "第2"'],
  );
  assert.deepEqual(out.errors, []);
});

test("BOM, CRLF and reordered columns", () => {
  const text =
    "﻿" +
    csv(["2026-04-01T10:00:00+09:00,内科,p1,v1", "2026-04-01T11:00:00+09:00,内科,p2,v2"], "visited_at,department,patient_id,visit_id", "\r\n");
  const out = aggregateVisits(text);
  assert.deepEqual(out.rows, [{ date: "2026-04-01", department: "内科", visits: 2, patients: 2 }]);
  assert.deepEqual(out.errors, []);
});

test("errors with line numbers", () => {
  const out = aggregateVisits(
    csv([
      "v1,p1,内科,2026-04-01T10:00:00+09:00",
      "v1,p1,内科,2026-04-01T10:00:00+09:00",
      "v2,p4,外科,2026-04-01T10:00:00",
      "v3,p5,外科,2026-04-31T10:00:00+09:00",
      "v4,,外科,2026-04-01T10:00:00+09:00",
      "v5,p6,外科",
      "",
      "v6,p7,外科,2026/04/01 10:00",
      "v7,p8,外科,2026-02-29T10:00:00+09:00",
      "v8,p9,外科,2026-04-01T10:00:00+09:00",
    ]),
  );
  assert.deepEqual(out.errors, [
    { line: 3, reason: "duplicate_visit_id" },
    { line: 4, reason: "missing_timezone" },
    { line: 5, reason: "invalid_timestamp" },
    { line: 6, reason: "missing_field" },
    { line: 7, reason: "column_count" },
    { line: 9, reason: "invalid_timestamp" },
    { line: 10, reason: "invalid_timestamp" },
  ]);
  assert.deepEqual(out.rows, [
    { date: "2026-04-01", department: "内科", visits: 1, patients: 1 },
    { date: "2026-04-01", department: "外科", visits: 1, patients: 1 },
  ]);
});

test("a duplicate of an invalid row is not a duplicate", () => {
  const out = aggregateVisits(csv(["v1,p1,内科,2026-04-01T10:00:00", "v1,p1,内科,2026-04-01T10:00:00+09:00"]));
  assert.deepEqual(out.errors, [{ line: 2, reason: "missing_timezone" }]);
  assert.equal(out.rows[0]?.visits, 1);
});

test("header only", () => assert.deepEqual(aggregateVisits(HEADER + "\n"), { rows: [], errors: [] }));

test("missing required column throws", () => {
  assert.throws(() => aggregateVisits("visit_id,patient_id,visited_at\nv1,p1,2026-04-01T10:00:00Z\n"));
});
