"""cp-0001 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは 1 個ずつ足して小計を作り、税は Decimal で「× 1.1 して小数部を切り捨て」で計算する。
"""
from decimal import ROUND_DOWN, Decimal


def brute(inp: str) -> str:
    lines = inp.strip("\n").split("\n")
    n, x, y = map(int, lines[0].split())
    s = 0
    for line in lines[1 : n + 1]:
        _, p, q = line.split()
        for _ in range(int(q)):
            s += int(p)
    t = s
    if s >= x:
        t = s - y
        if t < 0:
            t = 0
    pay = (Decimal(t) * Decimal("1.1")).quantize(Decimal(1), rounding=ROUND_DOWN)
    return f"{int(pay)}\n"
