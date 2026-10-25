"""cp-0036 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

荷物の部分集合 2^N 通りをすべて試し、重さ ≤ W・冷蔵品 ≤ C を満たすものの報酬の最大を取る（N ≤ 12 想定）。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, cap, cmax = tok[0], tok[1], tok[2]
    items = [(tok[3 + 3 * i], tok[4 + 3 * i], tok[5 + 3 * i]) for i in range(n)]
    best = 0
    for mask in range(1 << n):
        w = v = c = 0
        for i in range(n):
            if mask >> i & 1:
                w += items[i][0]
                v += items[i][1]
                c += items[i][2]
        if w <= cap and c <= cmax:
            best = max(best, v)
    return f"{best}\n"
