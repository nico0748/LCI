"""cp-0033 の素朴解（TLE させる想定）: 学期ごとに全科目を見直し、前提科目がすべて修了済みのものを取る。
1 学期あたり O(N + M) を S 回繰り返すので O(S × (N + M))。hidden-max-* では S = 3000 や 10^5 になり間に合わない。"""
import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, m = int(data[0]), int(data[1])
    pre = [[] for _ in range(n + 1)]
    for i in range(m):
        u, v = int(data[2 + 2 * i]), int(data[3 + 2 * i])
        pre[v].append(u)
    sem = [0] * (n + 1)  # 修了した学期（0 = 未修了）
    counts = []
    left = n
    while left:
        t = len(counts) + 1
        take = [v for v in range(1, n + 1) if sem[v] == 0 and all(0 < sem[u] < t for u in pre[v])]
        if not take:
            print(-1)
            return
        for v in take:
            sem[v] = t
        counts.append(len(take))
        left -= len(take)
    print(len(counts))
    print(*counts)


main()
