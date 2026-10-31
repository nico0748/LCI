import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, cap, cmax = int(tok[0]), int(tok[1]), int(tok[2])
    # dp[c][w] = 冷蔵品 c 個以下・重さの合計 w 以下で得られる報酬の最大（何も積まなければ 0）
    dp = [[0] * (cap + 1) for _ in range(cmax + 1)]
    for i in range(n):
        w, v, f = int(tok[3 + 3 * i]), int(tok[4 + 3 * i]), int(tok[5 + 3 * i])
        if w > cap:
            continue
        # 前の表（この荷物を使う前）から新しい行を丸ごと作るので、同じ荷物を 2 回使うことはない
        if f == 0:
            for c in range(cmax + 1):
                row = dp[c]
                dp[c] = row[:w] + [x if x >= y + v else y + v for x, y in zip(row[w:], row)]
        else:
            for c in range(cmax, 0, -1):  # 大きい c から更新すれば dp[c-1] はまだ古い（この荷物を使う前）
                row, low = dp[c], dp[c - 1]
                dp[c] = row[:w] + [x if x >= y + v else y + v for x, y in zip(row[w:], low)]
    print(dp[cmax][cap])


main()
