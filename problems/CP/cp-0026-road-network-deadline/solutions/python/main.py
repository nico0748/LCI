import sys
from heapq import heappop, heappush


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n, m, T = t[0], t[1], t[2]
    adj: list[list[tuple[int, int]]] = [[] for _ in range(n + 1)]
    for j in range(3, 3 + 3 * m, 3):
        u, v, w = t[j], t[j + 1], t[j + 2]
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = -1
    dist = [INF] * (n + 1)  # -1 = 未到達（Python の int は溢れない）
    dist[1] = 0
    pq = [(0, 1)]
    while pq:
        d, u = heappop(pq)
        if d > dist[u]:
            continue  # 古い要素（後でもっと短い距離が見つかった）は捨てる
        for v, w in adj[u]:
            nd = d + w
            if dist[v] == INF or nd < dist[v]:
                dist[v] = nd
                heappush(pq, (nd, v))
    within = sum(1 for d in dist[1:] if d != INF and d <= T)
    sys.stdout.write(f"{within}\n{dist[n]}\n")


main()
