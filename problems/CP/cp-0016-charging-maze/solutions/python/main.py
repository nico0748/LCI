import sys
from collections import deque


def main() -> None:
    lines = sys.stdin.read().split("\n")
    h, w, b = map(int, lines[0].split())
    g = "".join(lines[1 : 1 + h])  # 1 次元にする（マス v = r * w + c）
    start, goal = g.index("S"), g.index("G")
    k = b + 1
    # 状態 = (マス, 残量)。マスだけで訪問済みにすると、残量の多い再訪（充電してきた経路）を捨ててしまう
    dist = [-1] * (h * w * k)
    dist[start * k + b] = 0
    q = deque([start * k + b])
    while q:
        s = q.popleft()
        v, e = divmod(s, k)
        if e == 0:  # 電池切れ: ここからは動けない
            continue
        d = dist[s] + 1
        r, c = divmod(v, w)
        for u, ok in ((v - w, r > 0), (v + w, r + 1 < h), (v - 1, c > 0), (v + 1, c + 1 < w)):
            if not ok:
                continue
            ch = g[u]
            if ch == "#":
                continue
            if u == goal:  # 残量 0 で着いてもよい。BFS なので最初に着いた手数が最短
                sys.stdout.write(f"{d}\n")
                return
            t = u * k + (b if ch == "C" else e - 1)
            if dist[t] == -1:
                dist[t] = d
                q.append(t)
    sys.stdout.write("-1\n")


main()
