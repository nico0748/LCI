import sys
from collections import deque


def main() -> None:
    tokens = sys.stdin.read().split()
    h, w = int(tokens[0]), int(tokens[1])
    grid = "".join(tokens[2 : 2 + h])  # r * w + c で 1 次元に
    start, goal = grid.index("S"), grid.index("G")
    dist = [-1] * (h * w)
    dist[start] = 0
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == goal:
            break
        r, c = divmod(cur, w)
        d = dist[cur] + 1
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < h and 0 <= nc < w:
                nxt = nr * w + nc
                # 訪問済みはキューに入れる時点で付ける（同じマスを何度も積まない）
                if dist[nxt] < 0 and grid[nxt] != "#":
                    dist[nxt] = d
                    q.append(nxt)
    print(dist[goal])


main()
