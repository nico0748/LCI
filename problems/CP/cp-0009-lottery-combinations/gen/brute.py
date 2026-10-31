"""cp-0009 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（階乗と逆元の前計算）とは別の考え方で書く: パスカルの三角形 C(n, r) = C(n−1, r−1) + C(n−1, r) を
mod 998244353 で表に埋める（n ≤ 数十なので十分速い）。
"""

P = 998244353


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    q = tok[0]
    qs = [(tok[1 + 2 * i], tok[2 + 2 * i]) for i in range(q)]
    m = max(max(n, r) for n, r in qs)
    c = [[0] * (m + 1) for _ in range(m + 1)]
    for n in range(m + 1):
        c[n][0] = 1
        for r in range(1, n + 1):
            c[n][r] = (c[n - 1][r - 1] + c[n - 1][r]) % P
    return "\n".join(str(c[n][r]) for n, r in qs) + "\n"
