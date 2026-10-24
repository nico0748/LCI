import math
import unicodedata
from decimal import ROUND_HALF_UP, Decimal

# 検査項目 → 単位 → (a, b, 桁数)。「基準単位の値 = 値 × a + b」。
# 比例でない換算（HbA1c、体温）も切片 b で表せるので、組合せごとの if を書かずに済む
TABLE: dict[str, dict[str, tuple[float, float, int]]] = {
    "glucose": {"mg/dl": (1.0, 0.0, 0), "mmol/l": (18.0, 0.0, 1)},
    "creatinine": {"mg/dl": (1.0, 0.0, 2), "μmol/l": (1 / 88.4, 0.0, 0)},
    "cholesterol": {"mg/dl": (1.0, 0.0, 0), "mmol/l": (38.67, 0.0, 2)},
    "hba1c": {"%": (1.0, 0.0, 1), "mmol/mol": (1 / 10.929, 2.15, 0)},
    "body_temp": {"°c": (1.0, 0.0, 1), "°f": (5 / 9, -32 * 5 / 9, 1)},
}
ALIASES = {"umol/l": "μmol/l"}


def norm_unit(u: str) -> str:
    # NFKC: ＭＧ／ＤＬ → MG/DL、µ（U+00B5）→ μ（U+03BC）、℃ → °C
    s = "".join(unicodedata.normalize("NFKC", u).split()).lower()
    return ALIASES.get(s, s)


def round_half_up(x: float, digits: int) -> float:
    # repr で 2 進誤差を最短の 10 進表現に戻してから丸める（130.49999… を 130.5 として扱う）
    # Python の round は偶数丸めなので使わない
    q = Decimal(1).scaleb(-digits)
    return float(Decimal(repr(x)).quantize(q, rounding=ROUND_HALF_UP))


def convert(test: str, value: float, from_unit: str, to_unit: str) -> float:
    units = TABLE.get(test)
    if units is None:
        raise ValueError(f"未知の検査項目: {test!r}")
    try:
        a_from, b_from, _ = units[norm_unit(from_unit)]
        a_to, b_to, digits = units[norm_unit(to_unit)]
    except KeyError as e:
        raise ValueError(f"未知の単位: {e}") from None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("value は有限の数")
    base = value * a_from + b_from
    return round_half_up((base - b_to) / a_to, digits)
