# 素朴解（TLE させたい解）: 「店 i で買うなら、その前に買った最後の店は i−D 以前のどれか」と考え、
# best[i] = a_i + max(best[j] for j ≤ i−D) を毎回 j を全部見て求める O(N^2) の DP。
# D が小さい hidden-max-*（N = 2×10^5、D = 1）で約 2×10^10 回になり TLE。
# （「買う・買わない」を全部試す再帰は 2^N でさらに遅く、Python では深さ 2×10^5 の再帰で RecursionError になる）
import sys


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n, d = t[0], t[1]
    a = t[2 : 2 + n]
    best = [0] * n  # best[i] = 店 i で最後に買うときの最大
    for i in range(n):
        m = 0
        for j in range(0, i - d + 1):
            if best[j] > m:
                m = best[j]
        best[i] = a[i] + m
    print(max(best))


main()
