import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    # 累積和を 2 本: ps[i] = 1..i 日目の営業日の売上合計、pc[i] = 1..i 日目の営業日数
    ps = [0] * (n + 1)
    pc = [0] * (n + 1)
    s = c = 0
    for i in range(n):
        a = int(tok[2 + i])
        if a >= 0:  # 休業日（-1）は足さない。売上 0 の営業日は日数に数える
            s += a
            c += 1
        ps[i + 1] = s
        pc[i + 1] = c
    out = []
    p = 2 + n
    for _ in range(q):
        l, r = int(tok[p]), int(tok[p + 1])
        p += 2
        # 両端を含む L..R は「R までの和 − (L−1) までの和」
        out.append(f"{ps[r] - ps[l - 1]} {pc[r] - pc[l - 1]}")
    sys.stdout.write("\n".join(out) + "\n")


main()
