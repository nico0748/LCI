import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, m = int(data[0]), int(data[1])
    adj = [[] for _ in range(n + 1)]
    indeg = [0] * (n + 1)
    for i in range(m):
        u, v = int(data[2 + 2 * i]), int(data[3 + 2 * i])
        adj[u].append(v)  # 重複した辺もそのまま（入次数も同じ回数だけ数えるので整合する）
        indeg[v] += 1
    # 段ごとの Kahn 法: 入次数 0 の科目が 1 学期目、それを取り除いて 0 になった科目が次の学期
    cur = [v for v in range(1, n + 1) if indeg[v] == 0]
    counts = []
    done = 0
    while cur:
        counts.append(len(cur))
        done += len(cur)
        nxt = []
        for u in cur:
            for v in adj[u]:
                indeg[v] -= 1
                if indeg[v] == 0:
                    nxt.append(v)
        cur = nxt
    if done < n:  # 取り出せなかった科目が残る ⇔ 閉路がある
        sys.stdout.write("-1\n")
    else:
        sys.stdout.write(f"{len(counts)}\n{' '.join(map(str, counts))}\n")


main()
