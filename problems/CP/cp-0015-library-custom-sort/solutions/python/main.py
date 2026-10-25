import sys


def main() -> None:
    tok = sys.stdin.read().split()
    g = int(tok[0])
    rank = {name: i for i, name in enumerate(tok[1 : 1 + g])}
    n = int(tok[1 + g])
    keys = []
    p = 2 + g
    for _ in range(n):
        title, genre, year = tok[p], tok[p + 1], int(tok[p + 2])  # 年は int に直す（文字列のままだと "794" > "1200"）
        p += 3
        r = rank.get(genre, g)  # 一覧に無いジャンルは順位 G（一覧のどれよりも後ろ）
        # (ジャンルの順位, 一覧外ならジャンル名, 年の降順, 書名)。Python の str 比較は文字コード順（ASCII 順）
        keys.append((r, genre if r == g else "", -year, title))
    keys.sort()
    sys.stdout.write("".join(k[3] + "\n" for k in keys))


main()
