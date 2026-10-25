"""cp-0017 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは平均を分数（fractions.Fraction）のまま持ち、小数第 1 位までを「0.1 ずつ増やして平均を超えない最大の値」として求める。
"""
from fractions import Fraction


def brute(inp: str) -> str:
    tok = inp.split()
    n = int(tok[0])
    people = [(tok[1 + 2 * i], int(tok[2 + 2 * i])) for i in range(n)]
    avg = Fraction(sum(s for _, s in people), n)
    tenths = 0
    while Fraction(tenths + 1, 10) <= avg:
        tenths += 1
    shown = f"{tenths // 10}.{tenths % 10}"
    return "\n".join([shown] + [nm for nm, s in people if s >= avg]) + "\n"
