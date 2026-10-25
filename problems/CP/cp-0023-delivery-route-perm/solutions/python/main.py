import math
import sys
from itertools import permutations


def main() -> None:
    t = list(map(int, sys.stdin.read().split()))
    n, m = t[0], t[1]
    pts = [(t[2 + 2 * i], t[3 + 2 * i]) for i in range(n + 1)]
    k = 2 + 2 * (n + 1)
    need = [0] * (n + 1)  # need[b]: b より先に訪れる地点の集合（ビット）
    for j in range(m):
        a, b = t[k + 2 * j], t[k + 1 + 2 * j]
        need[b] |= 1 << a
    d = [[math.dist(p, q) for q in pts] for p in pts]
    best = math.inf
    # 8! = 40320 通り。条件を破る順列は途中で捨てる
    for perm in permutations(range(1, n + 1)):
        seen = 0
        ok = True
        for v in perm:
            if need[v] & ~seen:
                ok = False
                break
            seen |= 1 << v
        if not ok:
            continue
        total = d[0][perm[0]] + d[perm[-1]][0]
        for i in range(n - 1):
            total += d[perm[i]][perm[i + 1]]
        if total < best:
            best = total
    print(f"{best:.10f}")


main()
