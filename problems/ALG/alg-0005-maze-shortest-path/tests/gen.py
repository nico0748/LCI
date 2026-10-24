"""テストケース生成（固定シードで決定的）。期待値は BFS とは別の方法（距離の反復緩和）で計算する。

実行: python3 tests/gen.py   （problem ディレクトリで）
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))


def relax(grid):
    """全マスの距離を「隣 + 1」で変化がなくなるまで更新する（遅いが BFS と独立）。"""
    h, w = len(grid), len(grid[0])
    inf = 10**9
    dist = [[inf] * w for _ in range(h)]
    for r in range(h):
        for c in range(w):
            if grid[r][c] == "S":
                dist[r][c] = 0
    changed = True
    while changed:
        changed = False
        for r in range(h):
            for c in range(w):
                if grid[r][c] == "#":
                    continue
                best = dist[r][c]
                for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                    if 0 <= nr < h and 0 <= nc < w and dist[nr][nc] + 1 < best:
                        best = dist[nr][nc] + 1
                if best < dist[r][c]:
                    dist[r][c] = best
                    changed = True
    for r in range(h):
        for c in range(w):
            if grid[r][c] == "G":
                return dist[r][c] if dist[r][c] < inf else -1


def bfs(grid):
    from collections import deque

    h, w = len(grid), len(grid[0])
    s = next((r, c) for r in range(h) for c in range(w) if grid[r][c] == "S")
    dist = {s: 0}
    q = deque([s])
    while q:
        r, c = q.popleft()
        if grid[r][c] == "G":
            return dist[(r, c)]
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < h and 0 <= nc < w and grid[nr][nc] != "#" and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                q.append((nr, nc))
    return -1


def write(name, grid):
    with open(os.path.join(HERE, f"{name}.in"), "w") as f:
        f.write(f"{len(grid)} {len(grid[0])}\n" + "".join(row + "\n" for row in grid))
    ans = bfs(grid)
    if len(grid) * len(grid[0]) <= 2500:
        assert ans == relax(grid), name
    with open(os.path.join(HERE, f"{name}.out"), "w") as f:
        f.write(f"{ans}\n")


def place(rows, rng, s=None, g=None):
    h, w = len(rows), len(rows[0])
    cells = [list(r) for r in rows]
    free = [(r, c) for r in range(h) for c in range(w) if cells[r][c] == "."]
    if s is None:
        s = rng.choice(free)
    if g is None:
        g = rng.choice([p for p in free if p != s])
    cells[s[0]][s[1]] = "S"
    cells[g[0]][g[1]] = "G"
    return ["".join(r) for r in cells]


def random_grid(h, w, p, rng):
    return ["".join("#" if rng.random() < p else "." for _ in range(w)) for _ in range(h)]


def reachable_random(h, w, p, rng):
    """壁の密度 p のランダム迷路のうち、S から G に届くものを作り直しながら探す。"""
    while True:
        g = place(random_grid(h, w, p, rng), rng)
        if bfs(g) >= 0:
            return g


def serpentine(h, w):
    """1 本道のジグザグ迷路。経路長がほぼ HW/2 になる。"""
    rows = []
    for r in range(h):
        if r % 2 == 0:
            rows.append("." * w)
        elif r % 4 == 1:
            rows.append("#" * (w - 1) + ".")
        else:
            rows.append("." + "#" * (w - 1))
    return rows


def main():
    rng = random.Random(5)
    write("01", ["S..#.", ".#...", ".#.#.", "...#G"])
    write("02", ["S#G"])
    write("03", ["SG"])
    write("11", ["S", ".", ".", "G"])  # 1 列
    write("12", ["S.#", "##.", "..G"])  # 完全に遮断
    # DFS トラップ: 開けたグリッドでは、どの向きの順で DFS しても片方は遠回りの道を先に見つける
    open6 = ["." * 6 for _ in range(6)]
    write("13", place(open6, rng, s=(0, 0), g=(0, 2)))
    write("14", place(open6, rng, s=(0, 0), g=(2, 0)))
    for i in range(3):
        write(f"{15 + i}", reachable_random(rng.randint(5, 40), rng.randint(5, 40), 0.3, rng))
    write("21", place(["." * 500 for _ in range(500)], rng, s=(0, 0), g=(499, 499)))  # 開けた最大グリッド
    sp = serpentine(499, 500)
    write("22", place(sp, rng, s=(0, 0), g=(498, 0 if (498 // 2) % 2 == 1 else 499)))  # 長い 1 本道
    write("23", reachable_random(500, 500, 0.3, rng))
    blocked = ["." * 500 for _ in range(500)]
    blocked[250] = "#" * 500
    write("24", place(blocked, rng, s=(0, 0), g=(499, 499)))  # 大きいが到達不能


if __name__ == "__main__":
    main()
