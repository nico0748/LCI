import sys


def main() -> None:
    it = iter(sys.stdin.buffer.read().split())
    n, m = int(next(it)), int(next(it))
    price, mask = [], []
    for _ in range(n):
        p, k = int(next(it)), int(next(it))
        b = 0
        for _ in range(k):
            b |= 1 << (int(next(it)) - 1)  # 栄養 a をビット a-1 に
        price.append(p)
        mask.append(b)
    full = (1 << m) - 1
    size = 1 << n
    cover = [0] * size  # cover[s] = 集合 s の料理に含まれる栄養の OR
    cost = [0] * size  # cost[s] = 集合 s の合計金額（最大 15×10^9。Python の int は溢れない）
    best, ways = -1, 0
    for s in range(1, size):
        low = s & -s  # 最下位の 1 ビット = 集合 s で番号が最小の料理
        i = low.bit_length() - 1
        cover[s] = cover[s ^ low] | mask[i]  # 1 品少ない集合の結果を使い回す（O(1)）
        cost[s] = cost[s ^ low] + price[i]
        if cover[s] == full:
            if best == -1 or cost[s] < best:
                best, ways = cost[s], 1  # より安い組が見つかったら数え直す
            elif cost[s] == best:
                ways += 1
    sys.stdout.write("-1\n" if best == -1 else f"{best} {ways}\n")


main()
