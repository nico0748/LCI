# 素朴解（TLE させる想定）: クエリごとに n(n−1)…(n−r+1) と r! を掛けて、最後に 1 回だけ逆元を取る。O(r) / クエリ。
# hidden-max-half では r ≒ 5×10^5 のクエリが 9×10^4 個あり、約 4.5×10^10 回の掛け算になる。
import sys

P = 998244353


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    q = int(tok[0])
    out = []
    for i in range(q):
        n, r = int(tok[1 + 2 * i]), int(tok[2 + 2 * i])
        if r > n:
            out.append(0)
            continue
        r = min(r, n - r)
        num = den = 1
        for k in range(r):
            num = num * (n - k) % P
            den = den * (k + 1) % P
        out.append(num * pow(den, P - 2, P) % P)
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
