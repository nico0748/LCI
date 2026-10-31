"""cp-0019 の素朴解（TLE することを確かめる用。pnpm problems:selftest --only cp-0019 --naive）。

クエリごとに L〜R の各数を √x までの試し割りで判定する。1 クエリ最悪 O((R-L+1)√R)、Q = 10^5 では到底間に合わない。
"""
import sys


def is_prime(x: int) -> bool:
    if x < 2:
        return False
    d = 2
    while d * d <= x:
        if x % d == 0:
            return False
        d += 1
    return True


def main() -> None:
    tok = sys.stdin.read().split()
    q = int(tok[0])
    out = []
    for k in range(q):
        lo, hi = int(tok[1 + 2 * k]), int(tok[2 + 2 * k])
        out.append(sum(1 for x in range(lo, hi + 1) if is_prime(x)))
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
