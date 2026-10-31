import sys
from itertools import accumulate

DAY = 86400


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    # いもす法: 来場者は [s, t) にいるので diff[s] += 1, diff[t] -= 1。t = 86400 があるので 86401 要素
    diff = [0] * (DAY + 1)
    for i in range(1, 2 * n + 1, 2):
        diff[int(data[i])] += 1
        diff[int(data[i + 1])] -= 1
    cnt = list(accumulate(diff[:DAY]))  # cnt[x] = x 秒（0〜86399）に会場にいる人数
    peak = max(cnt)
    sys.stdout.write(f"{peak}\n{cnt.index(peak)}\n{cnt.count(peak)}\n")


main()
