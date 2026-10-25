# 素朴解（TLE させたい解）: 最大になりうる時刻（どれかの広告の開始時刻）ごとに、全広告を見て掲載中の単価を足す O(N^2)。
# 時刻を 0〜10^9 で 1 つずつ見る方法や 10^9 要素の配列は論外なので、「候補を開始時刻に絞る」までは気づいた素朴解。
# hidden-max-*（N = 10^5）で 10^10 回になり TLE
import sys


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n = t[0]
    S, E, C = t[1::3][:n], t[2::3][:n], t[3::3][:n]
    best, at = -1, -1
    for x in sorted(set(S)):
        f = 0
        for i in range(n):
            if S[i] <= x < E[i]:
                f += C[i]
        if f > best:
            best, at = f, x
    print(best, at)


main()
