"""cp-0040 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

多始点 BFS ではなく、道のマスごとに 1 回ずつ BFS して、最初に見つかった避難所までの歩数を求める（O((HW)^2)）。
"""
from collections import deque


def brute(inp: str) -> str:
    tok = inp.split()
    h, w = int(tok[0]), int(tok[1])
    g = tok[2 : 2 + h]
    shelters = any("S" in row for row in g)
    best = 0
    unreachable = 0
    for si in range(h):
        for sj in range(w):
            if g[si][sj] != ".":
                continue
            dist = {(si, sj): 0}
            dq = deque([(si, sj)])
            found = None
            while dq:
                i, j = dq.popleft()
                if g[i][j] == "S":
                    found = dist[(i, j)]
                    break
                for ni, nj in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)):
                    if 0 <= ni < h and 0 <= nj < w and g[ni][nj] != "#" and (ni, nj) not in dist:
                        dist[(ni, nj)] = dist[(i, j)] + 1
                        dq.append((ni, nj))
            if found is None:
                unreachable += 1
            else:
                best = max(best, found)
    return f"{best if shelters else -1} {unreachable}\n"
