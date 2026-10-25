"""cp-0036 の素朴解（TLE させる想定）: 荷物ごとに「積む / 積まない」を再帰で全部試す。
重さと冷蔵品の個数で枝刈りはするが、軽い荷物が多いと調べる組合せが 2^100 近くまで増える。"""
import sys


def main() -> None:
    tok = sys.stdin.read().split()
    n, cap, cmax = int(tok[0]), int(tok[1]), int(tok[2])
    items = [(int(tok[3 + 3 * i]), int(tok[4 + 3 * i]), int(tok[5 + 3 * i])) for i in range(n)]
    best = 0
    stack = [(0, 0, 0, 0)]  # (次に見る荷物, 重さ, 冷蔵品の数, 報酬)
    while stack:
        i, w, c, v = stack.pop()
        if v > best:
            best = v
        if i == n:
            continue
        wi, vi, fi = items[i]
        stack.append((i + 1, w, c, v))
        if w + wi <= cap and c + fi <= cmax:
            stack.append((i + 1, w + wi, c + fi, v + vi))
    print(best)


main()
