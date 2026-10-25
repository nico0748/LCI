# 素朴解（TLE させる想定）: クエリごとに L..R 日目を 1 日ずつ足す。O(N Q)。
# hidden-max-full-range ではほぼ全期間のクエリが 5×10^4 個あり、約 10^10 回の足し算になる。
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    a = list(map(int, tok[2 : 2 + n]))
    out = []
    p = 2 + n
    for _ in range(q):
        l, r = int(tok[p]), int(tok[p + 1])
        p += 2
        s = c = 0
        for d in range(l - 1, r):
            if a[d] >= 0:
                s += a[d]
                c += 1
        out.append(f"{s} {c}")
    sys.stdout.write("\n".join(out) + "\n")


main()
