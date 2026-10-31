"""cp-0011 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは「左端の候補 (r, c) を前から順に全部試し、K 席ぶんを毎回数え直す」O(HWK)。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    h, w, k = map(int, lines[0].split())
    grid = lines[1 : 1 + h]
    for r in range(h):
        for c in range(w - k + 1):
            if all(grid[r][c + d] == "." for d in range(k)):
                return f"{r + 1} {c + 1}\n"
    return "-1\n"
