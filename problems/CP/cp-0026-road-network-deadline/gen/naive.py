# 素朴解（TLE させたい解）: ヒープを使わず、毎回すべての拠点から「未確定で最小の距離」を探す O(N^2) の Dijkstra。
# 「TS や C にはヒープが無いので配列で探す」と書くとこうなる。N = 10^5 の hidden-max-* で 10^10 回になり TLE
import sys


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n, m, T = t[0], t[1], t[2]
    adj = [[] for _ in range(n + 1)]
    for j in range(m):
        u, v, w = t[3 + 3 * j], t[4 + 3 * j], t[5 + 3 * j]
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = float("inf")
    dist = [INF] * (n + 1)
    done = [False] * (n + 1)
    dist[1] = 0
    for _ in range(n):
        u, best = -1, INF
        for v in range(1, n + 1):
            if not done[v] and dist[v] < best:
                u, best = v, dist[v]
        if u == -1:
            break
        done[u] = True
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    within = sum(1 for d in dist[1:] if d <= T)
    print(within)
    print(dist[n] if dist[n] != INF else -1)


main()
