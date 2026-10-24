import unittest
from datetime import date, timedelta

from billing import items_in_period, paginate


def items(n):
    return [f"item-{i}" for i in range(n)]


class TestPaginate(unittest.TestCase):
    def test_reported_case_40_items(self):
        p2 = paginate(items(40), 2)
        self.assertEqual(p2["items"], items(40)[20:40])
        self.assertEqual(p2["total_pages"], 2)
        self.assertFalse(p2["has_next"])

    def test_first_page(self):
        p1 = paginate(items(45), 1)
        self.assertEqual(p1["items"], items(45)[0:20])
        self.assertEqual(p1["page"], 1)
        self.assertTrue(p1["has_next"])

    def test_partial_last_page(self):
        p3 = paginate(items(41), 3)
        self.assertEqual(p3["items"], ["item-40"])
        self.assertEqual(p3["total_pages"], 3)
        self.assertFalse(p3["has_next"])

    def test_zero_items_is_one_empty_page(self):
        self.assertEqual(paginate([], 1), {"items": [], "page": 1, "total_pages": 1, "has_next": False})

    def test_out_of_range(self):
        for n, page in ((40, 3), (40, 0), (0, 2), (5, -1)):
            with self.assertRaises(ValueError, msg=(n, page)):
                paginate(items(n), page)

    def test_every_item_exactly_once(self):
        for per_page in (1, 3, 20):
            for n in range(0, 62):
                seen = []
                page = 1
                while True:
                    p = paginate(items(n), page, per_page)
                    self.assertLessEqual(len(p["items"]), per_page)
                    seen.extend(p["items"])
                    if not p["has_next"]:
                        break
                    page += 1
                self.assertEqual(seen, items(n), (n, per_page))
                self.assertEqual(page, p["total_pages"])


class TestPeriod(unittest.TestCase):
    def test_inclusive_bounds(self):
        rows = [{"id": i, "billed_on": date(2026, 3, 31) + timedelta(days=i)} for i in range(32)]
        got = items_in_period(rows, date(2026, 4, 1), date(2026, 4, 30))
        self.assertEqual([r["id"] for r in got], list(range(1, 31)))
        self.assertEqual(got[0]["billed_on"], date(2026, 4, 1))
        self.assertEqual(got[-1]["billed_on"], date(2026, 4, 30))

    def test_single_day_and_order(self):
        rows = [
            {"id": "b", "billed_on": date(2026, 4, 15)},
            {"id": "a", "billed_on": date(2026, 4, 15)},
            {"id": "c", "billed_on": date(2026, 4, 16)},
        ]
        self.assertEqual([r["id"] for r in items_in_period(rows, date(2026, 4, 15), date(2026, 4, 15))], ["b", "a"])


if __name__ == "__main__":
    unittest.main()
