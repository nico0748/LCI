import unittest

from units import convert


class TestUnits(unittest.TestCase):
    def test_glucose(self):
        self.assertEqual(convert("glucose", 100, "mg/dL", "mmol/L"), 5.6)
        self.assertEqual(convert("glucose", 5.5, "mmol/L", "mg/dL"), 99)
        self.assertEqual(convert("glucose", 126, "mg/dL", "mmol/L"), 7.0)

    def test_creatinine(self):
        self.assertEqual(convert("creatinine", 1.0, "mg/dL", "μmol/L"), 88)
        self.assertEqual(convert("creatinine", 80, "μmol/L", "mg/dL"), 0.90)
        self.assertEqual(convert("creatinine", 0.65, "mg/dL", "umol/L"), 57)

    def test_cholesterol(self):
        self.assertEqual(convert("cholesterol", 200, "mg/dL", "mmol/L"), 5.17)
        self.assertEqual(convert("cholesterol", 5.0, "mmol/L", "mg/dL"), 193)

    def test_hba1c_is_affine(self):
        self.assertEqual(convert("hba1c", 6.5, "%", "mmol/mol"), 48)
        self.assertEqual(convert("hba1c", 53, "mmol/mol", "%"), 7.0)
        self.assertEqual(convert("hba1c", 2.15, "%", "mmol/mol"), 0)
        self.assertEqual(convert("hba1c", 0, "mmol/mol", "%"), 2.2)

    def test_body_temp_is_affine(self):
        self.assertEqual(convert("body_temp", 37.0, "°C", "°F"), 98.6)
        self.assertEqual(convert("body_temp", 98.6, "°F", "°C"), 37.0)
        self.assertEqual(convert("body_temp", -40, "°C", "°F"), -40.0)
        self.assertEqual(convert("body_temp", 0, "°C", "°F"), 32.0)

    def test_unit_variants(self):
        self.assertEqual(convert("glucose", 100, "mg/dl", "MMOL/L"), 5.6)
        self.assertEqual(convert("glucose", 100, "ＭＧ／ＤＬ", " mmol / L "), 5.6)
        self.assertEqual(convert("creatinine", 1.0, "mg/dL", "µmol/L"), 88)
        self.assertEqual(convert("creatinine", 1.0, "mg/dL", "μmol/l"), 88)
        self.assertEqual(convert("body_temp", 37.0, "℃", "℉"), 98.6)

    def test_same_unit_only_rounds(self):
        self.assertEqual(convert("glucose", 99.6, "mg/dL", "mg/dl"), 100)
        self.assertEqual(convert("creatinine", 0.904, "mg/dL", "mg/dL"), 0.90)

    def test_round_half_up_not_bankers(self):
        # 7.25 × 18 = 130.5 は 2 進でも正確に表せる。偶数丸めだと 130 になってしまう
        self.assertEqual(convert("glucose", 7.25, "mmol/L", "mg/dL"), 131)
        self.assertEqual(convert("glucose", 6.25, "mmol/L", "mg/dL"), 113)
        self.assertEqual(convert("glucose", 0.5, "mg/dL", "mg/dL"), 1)
        self.assertEqual(convert("glucose", 2.5, "mg/dL", "mg/dL"), 3)

    def test_round_half_away_from_zero_for_negative(self):
        self.assertEqual(convert("body_temp", -0.25, "°C", "°C"), -0.3)
        self.assertEqual(convert("body_temp", -2.5, "°C", "°C"), -2.5)

    def test_unknown(self):
        for args in (
            ("sodium", 140, "mEq/L", "mmol/L"),
            ("glucose", 100, "mg/dL", "g/L"),
            ("glucose", 100, "kg", "mmol/L"),
            ("hba1c", 6.5, "%", "mg/dL"),
            ("glucose", float("nan"), "mg/dL", "mmol/L"),
            ("glucose", float("inf"), "mg/dL", "mmol/L"),
            ("glucose", "100", "mg/dL", "mmol/L"),
        ):
            with self.assertRaises(ValueError, msg=repr(args)):
                convert(*args)


if __name__ == "__main__":
    unittest.main()
