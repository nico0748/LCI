"""cp-0025 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（2 次元累積和）とは別の考え方で、すべての K×K 区画を 1 マスずつ足し直す O(H W K^2)。
候補を (−合計, 行, 列) の組で集めて最小を取るので、同点の優先順も独立に確かめられる。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    h, w, k = map(int, lines[0].split())
    g = [[int(ch) for ch in lines[1 + i]] for i in range(h)]
    cands = []
    for r in range(h - k + 1):
        for c in range(w - k + 1):
            s = sum(g[r + dr][c + dc] for dr in range(k) for dc in range(k))
            cands.append((-s, r + 1, c + 1))
    s, r, c = min(cands)
    return f"{-s}\n{r} {c}\n"
