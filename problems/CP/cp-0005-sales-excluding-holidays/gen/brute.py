"""cp-0005 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（累積和）とは別に、クエリごとに L..R 日目を 1 日ずつ見て足す。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, q = tok[0], tok[1]
    a = tok[2 : 2 + n]
    lines = []
    for j in range(q):
        l, r = tok[2 + n + 2 * j], tok[3 + n + 2 * j]
        days = [a[d - 1] for d in range(l, r + 1) if a[d - 1] != -1]
        lines.append(f"{sum(days)} {len(days)}")
    return "\n".join(lines) + "\n"
