import re
import unicodedata
from datetime import date

_DATE_PATTERNS = (
    re.compile(r"^(\d{4})-(\d{2})-(\d{2})$"),
    re.compile(r"^(\d{4})/(\d{1,2})/(\d{1,2})$"),
    re.compile(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$"),
)


def normalize_kana(s: str) -> str:
    """NFKC（半角カナ→全角、濁点の合成）→ ひらがな→カタカナ → 空白と中黒を除く。

    ァ/ア や ヴ/ブ は同一視しない（誤統合を避けるため）。
    """
    s = unicodedata.normalize("NFKC", s or "")
    out = []
    for c in s:
        if "ぁ" <= c <= "ゖ":
            c = chr(ord(c) + 0x60)
        if c.isspace() or c == "・":
            continue
        out.append(c)
    return "".join(out)


def normalize_date(s: str) -> str | None:
    s = unicodedata.normalize("NFKC", s or "").strip()
    for pat in _DATE_PATTERNS:
        m = pat.match(s)
        if m:
            try:
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
            except ValueError:
                return None  # 2 月 30 日など存在しない日付
    return None


def _digits(phone: str | None) -> str:
    return "".join(c for c in unicodedata.normalize("NFKC", phone or "") if c.isdigit())


def find_duplicates(records: list[dict]) -> dict:
    """(正規化カナ, 生年月日) をキーにグループ化する。全組合せの比較はしないので O(n)。

    電話番号が食い違うグループは自動統合せず review に回す（別人の誤統合は取り返しがつかない）。
    """
    groups: dict[tuple[str, str], list[dict]] = {}
    invalid: list[str] = []
    for r in records:
        kana = normalize_kana(r.get("name_kana", ""))
        birth = normalize_date(r.get("birth_date", ""))
        if not kana or birth is None:
            invalid.append(r["id"])
            continue
        groups.setdefault((kana, birth), []).append(r)
    merge: list[list[str]] = []
    review: list[list[str]] = []
    for members in groups.values():
        if len(members) < 2:
            continue
        ids = sorted(m["id"] for m in members)
        phones = {_digits(m.get("phone")) for m in members} - {""}
        (review if len(phones) >= 2 else merge).append(ids)
    return {"merge": sorted(merge), "review": sorted(review), "invalid": sorted(invalid)}
