import sys


def main() -> None:
    lines = sys.stdin.read().split("\n")
    h, w, t = map(int, lines[0].split())
    g = [list(lines[1 + r]) for r in range(h)]
    for _ in range(t):
        # 二重バッファ: 判定は必ず前の日の g を見て、書き込みは新しい nxt にだけ行う
        nxt = [row[:] for row in g]
        for r in range(h):
            for c in range(w):
                ch = g[r][c]
                if ch == "#":
                    continue
                m = 0  # 上下左右の苔の数（盤の外は数えない。Python の g[-1] は最後の行になるので添字を必ず確かめる）
                if r > 0 and g[r - 1][c] == "o":
                    m += 1
                if r + 1 < h and g[r + 1][c] == "o":
                    m += 1
                if c > 0 and g[r][c - 1] == "o":
                    m += 1
                if c + 1 < w and g[r][c + 1] == "o":
                    m += 1
                if ch == ".":
                    if m >= 2:
                        nxt[r][c] = "o"
                elif m == 0 or m == 4:
                    nxt[r][c] = "."
        g = nxt
    sys.stdout.write("".join("".join(row) + "\n" for row in g))


main()
