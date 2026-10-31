import sys


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n, d = t[0], t[1]
    a = t[2 : 2 + n]
    # dp[i] = 店 1..i だけを使ったときの割引の最大（dp[0] = 0）
    # 店 i で買わない → dp[i-1]、買う → 直前に買えるのは店 i-D 以前なので dp[i-D] + a_i（i-D < 0 なら 0）
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        j = i - d
        take = a[i - 1] + (dp[j] if j >= 0 else 0)
        dp[i] = take if take > dp[i - 1] else dp[i - 1]
    sys.stdout.write(f"{dp[n]}\n")


main()
