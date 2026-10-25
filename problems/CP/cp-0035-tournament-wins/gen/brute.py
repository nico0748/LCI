"""cp-0035 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

回戦のシミュレーションではなく、選手ごとに数える: 選手が r 回戦に勝つ ⇔ 表の位置を含む長さ 2^r の
区間（区間は位置 0 から 2^r ずつ区切ったもの）の中で、その選手が最強（強さ最大、同じなら番号最小）。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    k = tok[0]
    n = 1 << k
    s = [0] + tok[1 : 1 + n]
    p = tok[1 + n : 1 + 2 * n]
    best = lambda xs: max(xs, key=lambda x: (s[x], -x))
    wins = [0] * (n + 1)
    for pos, x in enumerate(p):
        for r in range(1, k + 1):
            size = 1 << r
            lo = pos // size * size
            if best(p[lo : lo + size]) == x:
                wins[x] += 1
            else:
                break
    champion = best(p)
    return f"{champion}\n{' '.join(map(str, wins[1:]))}\n"
