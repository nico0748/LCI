"""cp-0018 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは塗りつぶしをせず、Union-Find で右と下の空きマスを併合して、根ごとに大きさを数える。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    h, w = map(int, lines[0].split())
    g = lines[1 : 1 + h]
    parent = list(range(h * w))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r in range(h):
        for c in range(w):
            if g[r][c] != ".":
                continue
            if c + 1 < w and g[r][c + 1] == ".":
                parent[find(r * w + c)] = find(r * w + c + 1)
            if r + 1 < h and g[r + 1][c] == ".":
                parent[find(r * w + c)] = find((r + 1) * w + c)
    size: dict[int, int] = {}
    for r in range(h):
        for c in range(w):
            if g[r][c] == ".":
                root = find(r * w + c)
                size[root] = size.get(root, 0) + 1
    return f"{len(size)} {max(size.values(), default=0)}\n"
