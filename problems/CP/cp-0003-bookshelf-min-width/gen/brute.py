"""cp-0003 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（答えの二分探索＋貪欲）とは別の考え方で書く: 区間 DP。
best[j][i] = 先頭 i 冊を j 段に分けたときの「最も広い段」の最小値。段は空でもよいので j = min(K, N) で十分。
"""


def brute(inp: str) -> str:
    tok = inp.split()
    n, k = int(tok[0]), int(tok[1])
    w = list(map(int, tok[2 : 2 + n]))
    inf = float("inf")
    shelves = min(k, n)
    best = [[inf] * (n + 1) for _ in range(shelves + 1)]
    best[0][0] = 0
    for j in range(1, shelves + 1):
        for i in range(n + 1):
            for p in range(i + 1):  # 最後の段に p+1..i 冊目を置く（空の段も許す）
                if best[j - 1][p] < inf:
                    best[j][i] = min(best[j][i], max(best[j - 1][p], sum(w[p:i])))
    return f"{best[shelves][n]}\n"
