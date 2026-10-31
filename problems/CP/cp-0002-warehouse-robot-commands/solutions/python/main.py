import sys


def main() -> None:
    tok = sys.stdin.read().split()
    h, w = int(tok[0]), int(tok[1])
    grid = tok[2 : 2 + h]
    cmds = tok[3 + h]
    r = c = 0
    for i, row in enumerate(grid):
        j = row.find("S")
        if j >= 0:
            r, c = i, j
    # 向き 0=北 1=東 2=南 3=西。L は -1 ではなく +3 して mod 4（負の剰余を作らない）
    dr = (-1, 0, 1, 0)
    dc = (0, 1, 0, -1)
    seen = [[False] * w for _ in range(h)]
    seen[r][c] = True  # 出発マスも「訪れたマス」に数える
    count = 1
    d = 0
    for ch in cmds:
        if ch == "F":
            nr, nc = r + dr[d], c + dc[d]
            # 盤面の外と棚（#）へは進めない。その命令は無視する
            if 0 <= nr < h and 0 <= nc < w and grid[nr][nc] != "#":
                r, c = nr, nc
                if not seen[r][c]:
                    seen[r][c] = True
                    count += 1
        elif ch == "R":
            d = (d + 1) % 4
        else:
            d = (d + 3) % 4
    sys.stdout.write(f"{r + 1} {c + 1}\n{count}\n")


main()
