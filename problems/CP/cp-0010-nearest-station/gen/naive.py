# 素朴解（TLE させる想定）: 家ごとに全部の駅との距離を測って最小を取る。O(N Q)。
# hidden-max-1 では 2×10^5 駅 × 5×10^4 軒 = 10^10 回の比較になる。
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    xs = list(map(int, tok[2 : 2 + n]))
    out = []
    for h in map(int, tok[2 + n : 2 + n + q]):
        best = 10**18
        for x in xs:
            d = x - h if x >= h else h - x
            if d < best:
                best = d
        out.append(best)
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
