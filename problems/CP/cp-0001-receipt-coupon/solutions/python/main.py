import sys


def main() -> None:
    tok = sys.stdin.read().split()
    n, x, y = int(tok[0]), int(tok[1]), int(tok[2])
    # 品名（tok[3 + 3i]）は使わない。単価 × 個数を足して小計を作る
    s = 0
    for i in range(n):
        s += int(tok[4 + 3 * i]) * int(tok[5 + 3 * i])
    # クーポンは「X 円以上」で使える。割引後は 0 円で止める
    t = max(s - y, 0) if s >= x else s
    # 税は整数演算で切り捨てる（t * 1.1 のような浮動小数は使わない）
    print(t + t * 10 // 100)


main()
