import sys
from bisect import bisect_left, bisect_right


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    ts = sorted(map(int, data[2 : 2 + n]))
    out = []
    for j in range(q):
        l, r = int(data[2 + n + 2 * j]), int(data[3 + n + 2 * j])
        # 「r 以下の個数」−「l 未満の個数」= [l, r] に入る個数
        out.append(bisect_right(ts, r) - bisect_left(ts, l))
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
