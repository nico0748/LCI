"""cp-0040 の素朴解（TLE させる想定）: 避難所ごとに BFS をやり直し、各マスの距離の最小を取る。
避難所の数を S とすると O(S × HW)。hidden-max-many-shelters は S ≈ 10^4、HW = 10^6 で 10^10 回。"""
import sys
from collections import deque


def main() -> None:
    data = sys.stdin.read().split()
    h, w = int(data[0]), int(data[1])
    g = data[2 : 2 + h]
    INF = 10**9
    best = [[INF] * w for _ in range(h)]
    shelters = [(i, j) for i in range(h) for j in range(w) if g[i][j] == "S"]
    for si, sj in shelters:
        dist = [[-1] * w for _ in range(h)]
        dist[si][sj] = 0
        dq = deque([(si, sj)])
        while dq:
            i, j = dq.popleft()
            d = dist[i][j]
            if d < best[i][j]:
                best[i][j] = d
            for ni, nj in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)):
                if 0 <= ni < h and 0 <= nj < w and g[ni][nj] != "#" and dist[ni][nj] < 0:
                    dist[ni][nj] = d + 1
                    dq.append((ni, nj))
    if not shelters:
        print(-1, sum(row.count(".") for row in g))
        return
    far = 0
    unreachable = 0
    for i in range(h):
        for j in range(w):
            if g[i][j] == ".":
                if best[i][j] == INF:
                    unreachable += 1
                else:
                    far = max(far, best[i][j])
    print(far, unreachable)


main()
