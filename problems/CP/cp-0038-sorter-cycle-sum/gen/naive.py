"""cp-0038 の素朴解（TLE させる想定）: K 回の移動をそのままシミュレーションする O(K)。K = 10^18 では終わらない。"""
import sys

MOD = 10**9 + 7


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, k = int(tok[0]), int(tok[1])
    t = [0] + [int(x) for x in tok[2 : 2 + n]]
    a = [0] + [int(x) for x in tok[2 + n : 2 + 2 * n]]
    x = 1
    total = 0
    for _ in range(k):
        total = (total + a[x]) % MOD
        x = t[x]
    print(x, total)


main()
