"""cp-0023 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（順列の列挙）とは別の考え方で、訪問済みの集合と最後の地点を状態にした bit DP で求める。
地点 v に進めるのは、v より先に訪れるべき地点がすべて訪問済みのときだけ。
"""
import math


def brute(inp: str) -> str:
    t = list(map(int, inp.split()))
    n, m = t[0], t[1]
    pts = [(t[2 + 2 * i], t[3 + 2 * i]) for i in range(n + 1)]
    k = 2 + 2 * (n + 1)
    pred = [0] * n  # 地点 v（0 始まりに詰め直す）より先に訪れる地点の集合
    for j in range(m):
        a, b = t[k + 2 * j] - 1, t[k + 1 + 2 * j] - 1
        pred[b] |= 1 << a

    def dist(i: int, j: int) -> float:  # i, j は pts の添字（0 が営業所）
        return math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])

    INF = float("inf")
    full = (1 << n) - 1
    dp = [[INF] * n for _ in range(1 << n)]
    for v in range(n):
        if pred[v] == 0:
            dp[1 << v][v] = dist(0, v + 1)
    for mask in range(1 << n):
        for last in range(n):
            cur = dp[mask][last]
            if cur == INF:
                continue
            for v in range(n):
                if mask >> v & 1 or pred[v] & ~mask:
                    continue
                nm = mask | 1 << v
                cand = cur + dist(last + 1, v + 1)
                if cand < dp[nm][v]:
                    dp[nm][v] = cand
    best = min(dp[full][v] + dist(v + 1, 0) for v in range(n))
    return f"{best:.10f}\n"
