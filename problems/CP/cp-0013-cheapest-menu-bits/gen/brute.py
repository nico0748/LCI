"""cp-0013 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここではビットマスクを使わず、itertools.combinations で選び方を列挙し、栄養は set の和集合で数える。
"""
from itertools import combinations


def brute(inp: str) -> str:
    it = iter(inp.split())
    n, m = int(next(it)), int(next(it))
    dishes = []
    for _ in range(n):
        p, k = int(next(it)), int(next(it))
        dishes.append((p, {int(next(it)) for _ in range(k)}))
    totals = []
    for size in range(1, n + 1):
        for pick in combinations(range(n), size):
            got: set[int] = set()
            for i in pick:
                got |= dishes[i][1]
            if got == set(range(1, m + 1)):
                totals.append(sum(dishes[i][0] for i in pick))
    if not totals:
        return "-1\n"
    best = min(totals)
    return f"{best} {totals.count(best)}\n"
