import random
import unittest

from dedupe import find_duplicates


def rec(i, name, birth, phone=None):
    return {"id": i, "name_kana": name, "birth_date": birth, "phone": phone}


class TestDedupe(unittest.TestCase):
    def test_kana_variants_merge(self):
        out = find_duplicates([
            rec("P001", "ヤマダ タロウ", "1990-01-02"),
            rec("P002", "やまだ　たろう", "1990-01-02"),
            rec("P003", "ﾔﾏﾀﾞ ﾀﾛｳ", "1990-01-02"),
            rec("P004", "ヤマダ・タロウ", "1990-01-02"),
        ])
        self.assertEqual(out, {"merge": [["P001", "P002", "P003", "P004"]], "review": [], "invalid": []})

    def test_date_formats(self):
        out = find_duplicates([
            rec("A1", "サトウ ハナコ", "1985-03-04"),
            rec("A2", "サトウ ハナコ", "1985/3/4"),
            rec("A3", "サトウ ハナコ", "1985年3月4日"),
            rec("A4", "サトウ ハナコ", "１９８５／０３／０４"),
        ])
        self.assertEqual(out["merge"], [["A1", "A2", "A3", "A4"]])

    def test_different_birth_date_not_grouped(self):
        out = find_duplicates([rec("A1", "サトウ ハナコ", "1985-03-04"), rec("A2", "サトウ ハナコ", "1985-03-05")])
        self.assertEqual(out, {"merge": [], "review": [], "invalid": []})

    def test_small_kana_and_vu_are_distinct(self):
        out = find_duplicates([
            rec("B1", "ヤマダ ショウ", "2000-01-01"),
            rec("B2", "ヤマダ シヨウ", "2000-01-01"),
            rec("B3", "ヴィクター", "2000-01-01"),
            rec("B4", "ビクター", "2000-01-01"),
            rec("B5", "ゔぃくたー", "2000-01-01"),
        ])
        self.assertEqual(out["merge"], [["B3", "B5"]])

    def test_phone_conflict_goes_to_review(self):
        out = find_duplicates([
            rec("C1", "スズキ イチロウ", "1970-07-07", "090-1234-5678"),
            rec("C2", "すずき いちろう", "1970-07-07", "080-9999-0000"),
        ])
        self.assertEqual(out, {"merge": [], "review": [["C1", "C2"]], "invalid": []})

    def test_phone_formats_are_same(self):
        out = find_duplicates([
            rec("D1", "タナカ ユイ", "1999-12-31", "090-1234-5678"),
            rec("D2", "タナカ ユイ", "1999-12-31", "０９０１２３４５６７８"),
            rec("D3", "タナカ ユイ", "1999-12-31", "(090) 1234 5678"),
        ])
        self.assertEqual(out["merge"], [["D1", "D2", "D3"]])

    def test_missing_phone_is_not_conflict(self):
        out = find_duplicates([
            rec("E1", "イトウ ケン", "1980-02-29", "03-1111-2222"),
            rec("E2", "イトウ ケン", "1980-02-29", None),
            rec("E3", "イトウ ケン", "1980-02-29", ""),
        ])
        self.assertEqual(out["merge"], [["E1", "E2", "E3"]])

    def test_invalid_records(self):
        out = find_duplicates([
            rec("F1", "ワタナベ", "1990-02-30"),
            rec("F2", "ワタナベ", ""),
            rec("F3", "ワタナベ", "H2.1.2"),
            rec("F4", "　 ", "1990-01-01"),
            rec("F5", "ワタナベ", "2023-02-29"),
            rec("F6", "ワタナベ", "1990-1-2"),
        ])
        self.assertEqual(out, {"merge": [], "review": [], "invalid": ["F1", "F2", "F3", "F4", "F5", "F6"]})

    def test_singletons_are_not_reported(self):
        self.assertEqual(find_duplicates([rec("G1", "コバヤシ", "2001-01-01")]), {"merge": [], "review": [], "invalid": []})

    def test_order_is_deterministic(self):
        rows = [
            rec("Z9", "ナカムラ", "1990-01-01"),
            rec("A5", "ナカムラ", "1990-01-01"),
            rec("M3", "キムラ", "1990-01-01", "1"),
            rec("B2", "キムラ", "1990-01-01", "2"),
            rec("C7", "ハヤシ", "1990-01-01"),
            rec("C1", "ハヤシ", "1990-01-01"),
            rec("X1", "", "1990-01-01"),
            rec("Q1", "ハヤシ", "bad"),
        ]
        expected = {"merge": [["A5", "Z9"], ["C1", "C7"]], "review": [["B2", "M3"]], "invalid": ["Q1", "X1"]}
        self.assertEqual(find_duplicates(rows), expected)
        rng = random.Random(1)
        for _ in range(5):
            rng.shuffle(rows)
            self.assertEqual(find_duplicates(rows), expected)

    def test_many_records(self):
        rows = [rec(f"R{i:05d}", f"カナ{i % 5000}", "1990-01-01") for i in range(10000)]
        out = find_duplicates(rows)
        self.assertEqual(len(out["merge"]), 5000)
        self.assertEqual(out["merge"][0], ["R00000", "R05000"])


if __name__ == "__main__":
    unittest.main()
