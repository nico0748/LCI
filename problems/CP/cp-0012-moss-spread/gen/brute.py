"""cp-0012 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは盤面を「苔の座標の集合」で持ち、隣の苔の数を辞書で数えて、毎日新しい集合を作る。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    h, w, t = map(int, lines[0].split())
    rows = lines[1 : 1 + h]
    moss = {(r, c) for r in range(h) for c in range(w) if rows[r][c] == "o"}
    rock = {(r, c) for r in range(h) for c in range(w) if rows[r][c] == "#"}
    for _ in range(t):
        cnt: dict[tuple[int, int], int] = {}
        for r, c in moss:
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if 0 <= nr < h and 0 <= nc < w:
                    cnt[(nr, nc)] = cnt.get((nr, nc), 0) + 1
        new = set()
        for r in range(h):
            for c in range(w):
                p = (r, c)
                if p in rock:
                    continue
                k = cnt.get(p, 0)
                if (p in moss and 1 <= k <= 3) or (p not in moss and k >= 2):
                    new.add(p)
        moss = new
    out = []
    for r in range(h):
        out.append("".join("#" if (r, c) in rock else "o" if (r, c) in moss else "." for c in range(w)))
    return "\n".join(out) + "\n"
