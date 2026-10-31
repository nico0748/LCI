import sys


def main() -> None:
    tok = sys.stdin.read().split()
    n, k = int(tok[0]), int(tok[1])
    dice = [int(x) for x in tok[2 : 2 + k]]
    m = int(tok[2 + k])
    warp = {}
    for j in range(m):
        warp[int(tok[3 + k + 2 * j])] = int(tok[4 + k + 2 * j])
    pos = 0
    for t, d in enumerate(dice, 1):
        pos += d
        if pos > n:  # 越えた分だけ戻る
            pos = n - (pos - n)
        if pos == n:  # ちょうど止まったときだけゴール。残りの出目は使わない
            print("GOAL", t)
            return
        pos = warp.get(pos, pos)  # ワープは 1 回だけ（出口のワープは使わない）
    print(pos)


main()
