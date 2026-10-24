import unittest

from visits import aggregate_visits

HEADER = "visit_id,patient_id,department,visited_at"


def csv(*lines, header=HEADER, nl="\n"):
    return nl.join([header, *lines]) + nl


class TestVisits(unittest.TestCase):
    def test_jst_day_boundary(self):
        out = aggregate_visits(csv(
            "v1,p1,内科,2026-03-31T14:59:59Z",
            "v2,p2,内科,2026-03-31T15:00:00Z",
        ))
        self.assertEqual(out["rows"], [
            {"date": "2026-03-31", "department": "内科", "visits": 1, "patients": 1},
            {"date": "2026-04-01", "department": "内科", "visits": 1, "patients": 1},
        ])
        self.assertEqual(out["errors"], [])

    def test_mixed_offsets(self):
        out = aggregate_visits(csv(
            "v1,p1,内科,2026-04-01T08:30:00+09:00",
            "v2,p2,内科,2026-03-31T20:00:00-05:00",
            "v3,p3,内科,2026-03-31T23:30:00+00:00",
            "v4,p4,内科,2026-04-01T23:59:59+09:00",
            "v5,p5,内科,2026-04-01T15:00:00Z",
        ))
        self.assertEqual(out["rows"], [
            {"date": "2026-04-01", "department": "内科", "visits": 4, "patients": 4},
            {"date": "2026-04-02", "department": "内科", "visits": 1, "patients": 1},
        ])

    def test_visits_and_unique_patients(self):
        out = aggregate_visits(csv(
            "v1,p1,内科,2026-04-01T09:00:00+09:00",
            "v2,p1,内科,2026-04-01T13:00:00+09:00",
            "v3,p2,内科,2026-04-01T10:00:00+09:00",
            "v4,p1,外科,2026-04-01T11:00:00+09:00",
        ))
        self.assertEqual(out["rows"], [
            {"date": "2026-04-01", "department": "内科", "visits": 3, "patients": 2},
            {"date": "2026-04-01", "department": "外科", "visits": 1, "patients": 1},
        ])

    def test_order_by_date_then_department(self):
        out = aggregate_visits(csv(
            "v1,p1,小児科,2026-04-02T09:00:00+09:00",
            "v2,p1,内科,2026-04-02T09:00:00+09:00",
            "v3,p1,皮膚科,2026-04-01T09:00:00+09:00",
        ))
        self.assertEqual([(r["date"], r["department"]) for r in out["rows"]], [
            ("2026-04-01", "皮膚科"), ("2026-04-02", "内科"), ("2026-04-02", "小児科"),
        ])

    def test_quoted_field_with_comma_and_escaped_quote(self):
        out = aggregate_visits(csv(
            'v1,p1,"小児科（夜間, 休日）",2026-04-01T10:00:00+09:00',
            'v2,p2,"眼科 ""第2""",2026-04-01T10:00:00+09:00',
        ))
        self.assertEqual([r["department"] for r in out["rows"]], ["小児科（夜間, 休日）", '眼科 "第2"'])
        self.assertEqual(out["errors"], [])

    def test_bom_crlf_and_reordered_columns(self):
        text = "﻿" + csv(
            "2026-04-01T10:00:00+09:00,内科,p1,v1",
            "2026-04-01T11:00:00+09:00,内科,p2,v2",
            header="visited_at,department,patient_id,visit_id",
            nl="\r\n",
        )
        out = aggregate_visits(text)
        self.assertEqual(out["rows"], [{"date": "2026-04-01", "department": "内科", "visits": 2, "patients": 2}])
        self.assertEqual(out["errors"], [])

    def test_errors_with_line_numbers(self):
        out = aggregate_visits(csv(
            "v1,p1,内科,2026-04-01T10:00:00+09:00",   # 2
            "v1,p1,内科,2026-04-01T10:00:00+09:00",   # 3 duplicate
            "v2,p4,外科,2026-04-01T10:00:00",         # 4 missing_timezone
            "v3,p5,外科,2026-04-31T10:00:00+09:00",   # 5 invalid_timestamp
            "v4,,外科,2026-04-01T10:00:00+09:00",     # 6 missing_field
            "v5,p6,外科",                             # 7 column_count
            "",                                        # 8 blank
            "v6,p7,外科,2026/04/01 10:00",            # 9 invalid_timestamp
            "v7,p8,外科,2026-02-29T10:00:00+09:00",   # 10 invalid (2026 is not leap)
            "v8,p9,外科,2026-04-01T10:00:00+09:00",   # 11 ok
        ))
        self.assertEqual(out["errors"], [
            {"line": 3, "reason": "duplicate_visit_id"},
            {"line": 4, "reason": "missing_timezone"},
            {"line": 5, "reason": "invalid_timestamp"},
            {"line": 6, "reason": "missing_field"},
            {"line": 7, "reason": "column_count"},
            {"line": 9, "reason": "invalid_timestamp"},
            {"line": 10, "reason": "invalid_timestamp"},
        ])
        self.assertEqual(out["rows"], [
            {"date": "2026-04-01", "department": "内科", "visits": 1, "patients": 1},
            {"date": "2026-04-01", "department": "外科", "visits": 1, "patients": 1},
        ])

    def test_duplicate_of_invalid_row_is_not_duplicate(self):
        out = aggregate_visits(csv(
            "v1,p1,内科,2026-04-01T10:00:00",
            "v1,p1,内科,2026-04-01T10:00:00+09:00",
        ))
        self.assertEqual(out["errors"], [{"line": 2, "reason": "missing_timezone"}])
        self.assertEqual(out["rows"][0]["visits"], 1)

    def test_header_only(self):
        self.assertEqual(aggregate_visits(HEADER + "\n"), {"rows": [], "errors": []})

    def test_missing_required_column(self):
        with self.assertRaises(ValueError):
            aggregate_visits("visit_id,patient_id,visited_at\nv1,p1,2026-04-01T10:00:00Z\n")


if __name__ == "__main__":
    unittest.main()
