"""cp-0016 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは「k 歩で到達できる (マス, 残量) の集合」を k = 0, 1, 2, … と 1 歩ずつ作り直し、G を含んだ最初の k を答える。
集合が前に出たものと同じになったら（それ以上新しい状態が無い）到達不能。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    h, w, b = map(int, lines[0].split())
    g = lines[1 : 1 + h]
    s = next((r, c) for r in range(h) for c in range(w) if g[r][c] == "S")
    cur = {(s[0], s[1], b)}
    seen = [frozenset(cur)]
    k = 0
    while True:
        k += 1
        nxt = set()
        for r, c, e in cur:
            if e == 0:
                continue
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if 0 <= nr < h and 0 <= nc < w and g[nr][nc] != "#":
                    if g[nr][nc] == "G":
                        return f"{k}\n"
                    nxt.add((nr, nc, b if g[nr][nc] == "C" else e - 1))
        fs = frozenset(nxt)
        if not nxt or fs in seen:
            return "-1\n"
        seen.append(fs)
        cur = nxt
