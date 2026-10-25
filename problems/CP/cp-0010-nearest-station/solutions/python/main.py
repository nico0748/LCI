import sys
from bisect import bisect_left


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    xs = sorted(map(int, tok[2 : 2 + n]))  # 整数としてソート（同じ座標の駅はそのまま残してよい）
    out = []
    for h in map(int, tok[2 + n : 2 + n + q]):
        i = bisect_left(xs, h)  # xs[i] は h 以上で最小の駅。最寄りは xs[i] か xs[i−1] のどちらか
        if i == 0:
            out.append(xs[0] - h)  # 先頭の駅より手前
        elif i == n:
            out.append(h - xs[-1])  # 末尾の駅より先
        else:
            out.append(min(xs[i] - h, h - xs[i - 1]))
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
