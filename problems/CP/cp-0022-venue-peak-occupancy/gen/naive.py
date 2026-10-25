# 素朴解（TLE させたい解）: 来場者ごとに滞在中の秒を 1 秒ずつ塗る。O(N × 滞在秒数) = 最大 2×10^5 × 86400 ≈ 1.7×10^10
# hidden-max-long-stay（ほぼ一日中いる人が 2×10^5 人）で制限を超えることを selftest --naive で確かめる
import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    cnt = [0] * 86400
    for i in range(n):
        s, t = int(data[1 + 2 * i]), int(data[2 + 2 * i])
        for x in range(s, t):
            cnt[x] += 1
    peak = max(cnt)
    sys.stdout.write(f"{peak}\n{cnt.index(peak)}\n{cnt.count(peak)}\n")


main()
