"""cp-0026 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（Dijkstra）とは別の考え方で、Bellman-Ford（全辺の緩和を変化が無くなるまで繰り返す）で最短時間を求める。
"""


def brute(inp: str) -> str:
    t = list(map(int, inp.split()))
    n, m, T = t[0], t[1], t[2]
    edges = [(t[3 + 3 * j], t[4 + 3 * j], t[5 + 3 * j]) for j in range(m)]
    dist: list[int | None] = [None] * (n + 1)
    dist[1] = 0
    changed = True
    while changed:
        changed = False
        for u, v, w in edges:
            for a, b in ((u, v), (v, u)):
                if dist[a] is not None and (dist[b] is None or dist[a] + w < dist[b]):
                    dist[b] = dist[a] + w
                    changed = True
    within = sum(1 for d in dist[1:] if d is not None and d <= T)
    return f"{within}\n{dist[n] if dist[n] is not None else -1}\n"
