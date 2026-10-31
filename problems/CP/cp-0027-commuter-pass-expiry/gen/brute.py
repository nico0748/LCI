"""cp-0027 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（月の通し番号と自前のうるう年判定）とは別の考え方で、標準ライブラリの datetime / calendar を使い、
1 か月ずつ k 回進めてから、その月に同じ日があるかを calendar.monthrange で確かめる。
"""
import calendar
from datetime import date, timedelta


def brute(inp: str) -> str:
    lines = inp.split("\n")
    q = int(lines[0])
    out = []
    for i in range(1, q + 1):
        s, k = lines[i].split()
        y, m, d = map(int, s.split("/"))
        for _ in range(int(k)):
            m += 1
            if m == 13:
                y, m = y + 1, 1
        last = calendar.monthrange(y, m)[1]
        e = date(y, m, last) if d > last else date(y, m, d) - timedelta(days=1)
        out.append(e.strftime("%Y/%m/%d"))
    return "\n".join(out) + "\n"
