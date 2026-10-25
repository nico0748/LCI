#!/usr/bin/env python3
"""cp-0016 充電スタンド付きの迷路 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0016 --naive` で hidden-max-* のどれかが TLE することを確かめる
- サイズ上限: .in 2.5MB・.out 1MB・tests/ 合計 6MB（L1 は 200KB）。`pnpm problems:validate` も検査する
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TESTS_JSON = ROOT / "tests.json"
sys.path.insert(0, str(HERE))
from brute import brute  # noqa: E402  小さい入力用の全探索（gen/brute.py）

STRESS = 300
MASK = (1 << 64) - 1


class SplitMix64:
    """自前の 64bit 擬似乱数。同じ seed なら Python の版によらず同じ列になる"""

    def __init__(self, seed: int) -> None:
        self.state = seed & MASK

    def next_u64(self) -> int:
        self.state = (self.state + 0x9E3779B97F4A7C15) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)

    def randint(self, lo: int, hi: int) -> int:
        """lo 以上 hi 以下（両端を含む）"""
        return lo + self.next_u64() % (hi - lo + 1)

    def choice(self, xs):
        return xs[self.randint(0, len(xs) - 1)]

    def shuffle(self, xs: list) -> None:
        for i in range(len(xs) - 1, 0, -1):
            j = self.randint(0, i)
            xs[i], xs[j] = xs[j], xs[i]


# ---- 問題ごとに書くところ ----------------------------------------------------------


from collections import deque


def parse(inp: str) -> tuple[int, int, int, list[str]]:
    lines = inp.split("\n")
    h, w, b = map(int, lines[0].split())
    return h, w, b, lines[1 : 1 + h]


def solve(inp: str) -> str:
    """想定解。状態を (マス, 残量) にした BFS。状態数は H·W·(B+1) ≤ 60·60·61、遷移は 4 倍"""
    h, w, b, g = parse(inp)
    start = goal = -1
    for r in range(h):
        for c in range(w):
            if g[r][c] == "S":
                start = r * w + c
            elif g[r][c] == "G":
                goal = r * w + c
    dist = [-1] * (h * w * (b + 1))
    dist[start * (b + 1) + b] = 0
    q = deque([(start, b)])
    while q:
        v, e = q.popleft()
        d = dist[v * (b + 1) + e]
        if e == 0:
            continue
        r, c = divmod(v, w)
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if not (0 <= nr < h and 0 <= nc < w) or g[nr][nc] == "#":
                continue
            u = nr * w + nc
            if u == goal:
                return f"{d + 1}\n"
            ne = b if g[nr][nc] == "C" else e - 1
            k = u * (b + 1) + ne
            if dist[k] == -1:
                dist[k] = d + 1
                q.append((u, ne))
    return "-1\n"


def cell_only(inp: str) -> str:
    """罠の確認用（誤答）: マスごとに 1 回しか訪問しない BFS。残量の多い再訪を捨てる"""
    h, w, b, g = parse(inp)
    start = next(r * w + c for r in range(h) for c in range(w) if g[r][c] == "S")
    seen = {start}
    q = deque([(start, b, 0)])
    while q:
        v, e, d = q.popleft()
        if e == 0:
            continue
        r, c = divmod(v, w)
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < h and 0 <= nc < w and g[nr][nc] != "#" and nr * w + nc not in seen:
                if g[nr][nc] == "G":
                    return f"{d + 1}\n"
                seen.add(nr * w + nc)
                q.append((nr * w + nc, b if g[nr][nc] == "C" else e - 1, d + 1))
    return "-1\n"


def make(b: int, rows: list[str]) -> str:
    h, w = len(rows), len(rows[0])
    assert 1 <= h <= 60 and 1 <= w <= 60 and 1 <= b <= 60 and all(len(s) == w for s in rows)
    flat = "".join(rows)
    assert flat.count("S") == 1 and flat.count("G") == 1 and set(flat) <= set(".#SGC")
    return f"{h} {w} {b}\n" + "".join(s + "\n" for s in rows)


def random_grid(rng: SplitMix64, h: int, w: int, wall: int, charger: int) -> list[str]:
    cells = []
    for _ in range(h * w):
        x = rng.randint(1, 100)
        cells.append("#" if x <= wall else "C" if x <= wall + charger else ".")
    s = rng.randint(0, h * w - 1)
    gl = rng.randint(0, h * w - 2)
    if gl >= s:
        gl += 1
    cells[s], cells[gl] = "S", "G"
    return ["".join(cells[r * w : (r + 1) * w]) for r in range(h)]


def random_small(rng: SplitMix64) -> str:
    h, w = rng.randint(1, 5), rng.randint(2, 6)
    return make(rng.randint(1, 6), random_grid(rng, h, w, rng.choice([0, 15, 30]), rng.choice([0, 8, 20])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def search(rng: SplitMix64, h: int, w: int, bmax: int, wall: int, charger: int, want, tries: int = 4000) -> str:
    """want(正解, 誤答) を満たす入力を乱数で探す（決定的: 同じ rng なら同じ結果）"""
    for _ in range(tries):
        inp = make(rng.randint(2, bmax), random_grid(rng, h, w, wall, charger))
        if want(solve(inp), cell_only(inp)):
            return inp
    raise AssertionError("見つからない")


def serpentine(h: int, w: int, b: int, every: int) -> list[str]:
    """蛇行する 1 本道。偶数行は通路、奇数行は壁で端だけ開ける。通路に every 歩ごとに充電マス"""
    g = [["#"] * w for _ in range(h)]
    path = []
    for r in range(0, h, 2):
        cols = range(w) if (r // 2) % 2 == 0 else range(w - 1, -1, -1)
        for c in cols:
            path.append((r, c))
        if r + 1 < h:
            path.append((r + 1, w - 1 if (r // 2) % 2 == 0 else 0))
    for i, (r, c) in enumerate(path):
        g[r][c] = "C" if i % every == 0 and i else "."
    sr, sc = path[0]
    gr, gc = path[-1]
    g[sr][sc], g[gr][gc] = "S", "G"
    return ["".join(row) for row in g]


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3 6 5\nS....#\n###C.#\nG.....\n"))
    out.append(("sample-2-unreachable", "sample", "2 6 2\nS..C..\n#####G\n"))
    rng = SplitMix64(0x5EED_0016)
    out.append(("hidden-min-adjacent", "hidden", make(1, ["SG"])))
    # 残量 0 でちょうど G に着くのは可（「着いた後に残量 1 以上」と判定すると -1 になる）
    out.append(("hidden-trap-zero-at-goal", "hidden", make(20, ["S.........", "#########.", "G........."])))
    out.append(("hidden-trap-zero-at-goal-via-charger", "hidden", make(3, ["S..C..G"])))
    # 残量の多い再訪を捨てると不正解になる（マスだけで訪問済みを管理する BFS は、遠回りの充電経路を捨てる）
    out.append(("hidden-trap-cell-only-longer", "hidden", search(rng, 6, 8, 6, 20, 8, lambda a, b: a != "-1\n" and b != "-1\n" and a != b)))
    out.append(("hidden-trap-cell-only-unreachable", "hidden", search(rng, 6, 8, 6, 20, 8, lambda a, b: a != "-1\n" and b == "-1\n")))
    out.append(("hidden-edge-unreachable-walls", "hidden", make(60, ["S.#....", "..#.C..", "###....", "......G"])))
    out.append(("hidden-edge-unreachable-battery", "hidden", make(5, ["S.........C......G"])))
    out.append(("hidden-edge-b1-chain", "hidden", make(1, ["SCCCC.", "####CG"])))
    for i in range(3):
        h, w = rng.randint(4, 10), rng.randint(4, 10)
        out.append((f"hidden-rand-{i + 1}", "hidden", make(rng.randint(2, 8), random_grid(rng, h, w, 20, 10))))
    out.append(("hidden-mid-cell-only", "hidden", search(rng, 25, 25, 12, 25, 4, lambda a, b: a != "-1\n" and a != b, 400)))
    # 最大: 60×60 の蛇行。充電マスが電池ちょうどの間隔で並び、どれを飛ばしても届かない
    out.append(("hidden-max-serpentine", "hidden", make(7, serpentine(60, 60, 7, 7))))
    # 最大: 60×60、B=60、壁が少なく充電マスが多い（状態 (マス, 残量) がほぼ全部現れる）
    out.append(("hidden-max-open-many-chargers", "hidden", make(60, random_grid(rng, 60, 60, 10, 15))))
    # 最大: G が壁で囲まれていて着けない。開けた盤面で充電マスも多く、(マス, 残量) の状態をほぼすべて調べ尽くす（BFS の最悪）
    rows = [list(s) for s in random_grid(rng, 60, 60, 8, 12)]
    for r in range(60):
        for c in range(60):
            if rows[r][c] in "SG":
                rows[r][c] = "."
    rows[0][0], rows[59][59], rows[58][59], rows[59][58], rows[58][58] = "S", "G", "#", "#", "#"
    out.append(("hidden-max-unreachable-explore-all", "hidden", make(60, ["".join(r) for r in rows])))
    out.append(("hidden-max-cell-only", "hidden", search(rng, 60, 60, 25, 30, 3, lambda a, b: a != "-1\n" and a != b, 200)))
    return out


# ---- ここから下は共通 ------------------------------------------------------------------


def build() -> tuple[list[dict], dict[str, str]]:
    """tests.json の cases と、書き出すファイル（tests/ からの相対パス → 内容）"""
    entries: list[dict] = []
    files: dict[str, str] = {}
    nums = {"sample": 1, "hidden": 11}
    names: set[str] = set()
    for name, vis, stdin in cases():
        assert vis in nums, f"visibility は sample / hidden: {name}"
        assert name not in names, f"ケース名が重複: {name}"
        names.add(name)
        no = nums[vis]
        nums[vis] += 1
        stem = f"tests/{no:02d}"
        files[f"{stem}.in"] = stdin
        files[f"{stem}.out"] = solve(stdin)
        entries.append({"name": name, "visibility": vis, "stdinFile": f"{stem}.in", "expectedFile": f"{stem}.out"})
    assert nums["sample"] <= 4, "sample は 3 件まで（01〜03）"
    return entries, files


def render_tests_json(entries: list[dict]) -> str:
    """tests.json の cases だけを差し替える（limits・compare などは手で書いたものを残す）。1 ケース 1 行"""
    data = json.loads(TESTS_JSON.read_text(encoding="utf-8"))
    data["cases"] = entries
    keys = list(data.keys())
    lines = ["{"]
    for i, k in enumerate(keys):
        comma = "," if i < len(keys) - 1 else ""
        if k == "cases":
            lines.append('  "cases": [')
            for j, c in enumerate(entries):
                lines.append("    " + json.dumps(c, ensure_ascii=False) + ("," if j < len(entries) - 1 else ""))
            lines.append("  ]" + comma)
        else:
            lines.append(f"  {json.dumps(k)}: {json.dumps(data[k], ensure_ascii=False)}{comma}")
    lines.append("}")
    return "\n".join(lines) + "\n"


def stale_files(files: dict[str, str]) -> list[str]:
    """tests/ にあるが今回は作らない NN.in / NN.out（ケースを減らしたときの消し忘れ）"""
    d = ROOT / "tests"
    if not d.is_dir():
        return []
    return sorted(f"tests/{p.name}" for p in d.iterdir() if re.fullmatch(r"\d+\.(in|out)", p.name) and f"tests/{p.name}" not in files)


def size_report(files: dict[str, str]) -> str:
    sizes = {k: len(v.encode()) for k, v in files.items()}
    big_in = max((v for k, v in sizes.items() if k.endswith(".in")), default=0)
    big_out = max((v for k, v in sizes.items() if k.endswith(".out")), default=0)
    return f"tests/ 合計 {sum(sizes.values()):,} B（上限 6,000,000）、最大の .in {big_in:,} B（2,500,000）、最大の .out {big_out:,} B（1,000,000）"


def main() -> int:
    check = "--check" in sys.argv[1:]
    entries, files = build()
    tests_json = render_tests_json(entries)
    if not check:
        for rel, content in files.items():
            p = ROOT / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8", newline="\n")
        for rel in stale_files(files):
            (ROOT / rel).unlink()
            print(f"削除: {rel}")
        TESTS_JSON.write_text(tests_json, encoding="utf-8", newline="\n")
        print(f"{len(entries)} ケースを書きました。{size_report(files)}")
        return 0

    ng: list[str] = []
    for rel, content in files.items():
        p = ROOT / rel
        if not p.exists():
            ng.append(f"{rel} が無い")
        elif p.read_bytes() != content.encode():
            ng.append(f"{rel} が再生成と一致しない")
    ng += [f"{rel} は生成されない古いファイル" for rel in stale_files(files)]
    if TESTS_JSON.read_text(encoding="utf-8") != tests_json:
        ng.append("tests.json の cases が再生成と一致しない")
    rng = SplitMix64(0x5EED_FFFF)
    for i in range(STRESS):
        inp = random_small(rng)
        want, got = brute(inp), solve(inp)
        if not same(got, want):
            ng.append(f"stress {i + 1}: solve と brute が不一致\n--- 入力\n{inp}--- brute\n{want}--- solve\n{got}")
            break
    for m in ng:
        print("NG", m)
    print(f"{'OK' if not ng else 'NG'}: {len(entries)} ケース、stress {STRESS} 件。{size_report(files)}")
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
