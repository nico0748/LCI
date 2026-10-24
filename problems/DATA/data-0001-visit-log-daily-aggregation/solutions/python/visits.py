import csv
import io
import re
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))  # 日本は夏時間が無いので固定オフセットで正しい
REQUIRED = ("visit_id", "patient_id", "department", "visited_at")
_TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$")


def _parse_ts(s: str) -> tuple[datetime | None, str | None]:
    m = _TS.match(s)
    if not m:
        return None, "invalid_timestamp"
    if m.group(1) is None:
        # オフセットが無い時刻はどこの時刻か分からない。サーバーのローカル時刻で推測しない
        return None, "missing_timezone"
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")), None
    except ValueError:
        return None, "invalid_timestamp"  # 2 月 30 日など


def aggregate_visits(csv_text: str) -> dict:
    """受付ログ CSV を日本時間の日付×診療科で集計する。

    不正な行は処理を止めずに行番号と理由を errors に積み、残りの行を集計する。
    """
    text = csv_text.lstrip("﻿")  # Excel が付ける BOM
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        raise ValueError("ヘッダがありません")
    pos = {name: i for i, name in enumerate(header)}
    missing = [c for c in REQUIRED if c not in pos]
    if missing:
        raise ValueError(f"必要な列がありません: {missing}")

    errors: list[dict] = []
    seen: set[str] = set()
    groups: dict[tuple[str, str], tuple[int, set[str]]] = {}
    for fields in reader:
        line = reader.line_num  # フィールド内改行が無い前提なので物理行番号と一致する
        if not fields or all(not f.strip() for f in fields):
            continue
        if len(fields) != len(header):
            errors.append({"line": line, "reason": "column_count"})
            continue
        rec = {c: fields[pos[c]].strip() for c in REQUIRED}
        if any(not v for v in rec.values()):
            errors.append({"line": line, "reason": "missing_field"})
            continue
        dt, reason = _parse_ts(rec["visited_at"])
        if reason:
            errors.append({"line": line, "reason": reason})
            continue
        if rec["visit_id"] in seen:
            errors.append({"line": line, "reason": "duplicate_visit_id"})
            continue
        seen.add(rec["visit_id"])
        key = (dt.astimezone(JST).date().isoformat(), rec["department"])
        visits, patients = groups.get(key, (0, set()))
        patients.add(rec["patient_id"])
        groups[key] = (visits + 1, patients)

    rows = [
        {"date": d, "department": dept, "visits": v, "patients": len(ps)}
        for (d, dept), (v, ps) in sorted(groups.items())
    ]
    return {"rows": rows, "errors": errors}
