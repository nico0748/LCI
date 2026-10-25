"""cp-0031 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（スタンプを順に塗る）とは逆向きに、キャンバスの各マスについて「最後に押したスタンプから順に」
そのマスを不透明な文字で覆うものを探す。最初に見つかった文字がそのマスの答え（無ければ '.'）。
"""


def brute(inp: str) -> str:
    lines = inp.split("\n")
    hh, ww, n = map(int, lines[0].split())
    stamps = []
    p = 1
    for _ in range(n):
        h, w, r, c = map(int, lines[p].split())
        rows = lines[p + 1 : p + 1 + h]
        stamps.append((r, c, h, w, rows))
        p += 1 + h
    out = []
    for y in range(1, hh + 1):
        row = []
        for x in range(1, ww + 1):
            ch = "."
            for r, c, h, w, rows in reversed(stamps):
                if r <= y < r + h and c <= x < c + w and rows[y - r][x - c] != ".":
                    ch = rows[y - r][x - c]
                    break
            row.append(ch)
        out.append("".join(row))
    return "\n".join(out) + "\n"
