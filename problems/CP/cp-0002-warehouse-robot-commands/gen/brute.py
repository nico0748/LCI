"""cp-0002 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で書く: 向きを複素数（北 = -1、右回転 = ×(-i)... ではなく、行・列の組を回転行列で回す）で持ち、
訪れたマスは座標の集合で数える。
"""


def brute(inp: str) -> str:
    lines = inp.strip("\n").split("\n")
    h, w = map(int, lines[0].split())
    grid = lines[1 : 1 + h]
    cmds = lines[2 + h].strip() if len(lines) > 2 + h else ""
    pos = next((i, j) for i in range(h) for j in range(w) if grid[i][j] == "S")
    dr, dc = -1, 0  # 北
    visited = {pos}
    for ch in cmds:
        if ch == "R":
            dr, dc = dc, -dr  # (行, 列) を時計回りに 90 度
        elif ch == "L":
            dr, dc = -dc, dr  # 反時計回りに 90 度
        else:
            r, c = pos[0] + dr, pos[1] + dc
            if r < 0 or r >= h or c < 0 or c >= w:
                continue
            if grid[r][c] == "#":
                continue
            pos = (r, c)
            visited.add(pos)
    return f"{pos[0] + 1} {pos[1] + 1}\n{len(visited)}\n"
