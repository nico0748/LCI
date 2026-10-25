#!/usr/bin/env python3
"""cp-0018 駐車場の空き区画のまとまり のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0018 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


def solve(inp: str) -> str:
    """想定解。盤の周りを # で囲んで 1 次元にし、未訪問の空きマスから明示的なスタックで塗る（再帰を使わない）。O(HW)"""
    lines = inp.split("\n")
    h, w = map(int, lines[0].split())
    w2 = w + 2
    g = bytearray(b"#" * w2)
    for r in range(h):
        g += b"#" + lines[1 + r].encode() + b"#"
    g += b"#" * w2
    count = best = 0
    pos = g.find(b".")
    while pos != -1:
        count += 1
        g[pos] = 35
        stack = [pos]
        area = 0
        while stack:
            p = stack.pop()
            area += 1
            for q in (p - 1, p + 1, p - w2, p + w2):
                if g[q] == 46:
                    g[q] = 35
                    stack.append(q)
        best = max(best, area)
        pos = g.find(b".", pos)
    return f"{count} {best}\n"


def make(rows: list[str]) -> str:
    h, w = len(rows), len(rows[0])
    assert 1 <= h <= 1000 and 1 <= w <= 1000 and all(len(s) == w and set(s) <= {".", "#"} for s in rows)
    return f"{h} {w}\n" + "".join(s + "\n" for s in rows)


def random_rows(rng: SplitMix64, h: int, w: int, wall_pct: int) -> list[str]:
    return ["".join("#" if rng.randint(1, 100) <= wall_pct else "." for _ in range(w)) for _ in range(h)]


def random_small(rng: SplitMix64) -> str:
    h, w = rng.randint(1, 6), rng.randint(1, 6)
    return make(random_rows(rng, h, w, rng.choice([0, 20, 40, 55, 70, 100])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def serpentine(h: int, w: int) -> list[str]:
    """蛇行する 1 本道（偶数行が通路、奇数行は壁で左右交互に 1 マスだけ開ける）。再帰 DFS の深さが約 HW/2 になる"""
    rows = []
    for r in range(h):
        if r % 2 == 0:
            rows.append("." * w)
        elif (r // 2) % 2 == 0:
            rows.append("#" * (w - 1) + ".")
        else:
            rows.append("." + "#" * (w - 1))
    return rows


def spiral(n: int) -> list[str]:
    """渦巻きの 1 本道（壁の厚さ 1、通路の幅 1）"""
    g = [["#"] * n for _ in range(n)]
    r, c, dr, dc = 0, 0, 0, 1
    g[0][0] = "."
    while True:
        moved = False
        for _ in range(4):
            nr, nc = r + 2 * dr, c + 2 * dc
            if 0 <= nr < n and 0 <= nc < n and g[nr][nc] == "#" and all(
                not (0 <= nr + a < n and 0 <= nc + b < n) or g[nr + a][nc + b] == "#" or (nr + a, nc + b) == (r + dr, c + dc)
                for a, b in ((0, 1), (1, 0), (0, -1), (-1, 0))
            ):
                g[r + dr][c + dc] = "."
                g[nr][nc] = "."
                r, c = nr, nc
                moved = True
                break
            dr, dc = dc, -dr
        if not moved:
            break
    return ["".join(row) for row in g]


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 6\n..#...\n.##.#.\n#..##.\n#.#..#\n"))
    out.append(("sample-2-full", "sample", "2 3\n###\n###\n"))
    rng = SplitMix64(0x5EED_0018)
    out.append(("hidden-min-free", "hidden", make(["."])))
    out.append(("hidden-min-wall", "hidden", make(["#"])))
    out.append(("hidden-edge-all-free-small", "hidden", make(["....."] * 4)))
    # 斜めだけでつながるマスは別のまとまり（8 方向で数えると 1 つになってしまう）
    out.append(("hidden-trap-diagonal", "hidden", make([".#.#.", "#.#.#", ".#.#.", "#.#.#"])))
    out.append(("hidden-trap-all-wall", "hidden", make(["#" * 30] * 20)))
    out.append(("hidden-edge-one-row", "hidden", make([".#..#...#....#....."])))
    out.append(("hidden-edge-one-col", "hidden", make(list(".#..#...#...."))))
    for i in range(3):
        h, w = rng.randint(5, 20), rng.randint(5, 20)
        out.append((f"hidden-rand-{i + 1}", "hidden", make(random_rows(rng, h, w, rng.choice([30, 45, 60])))))
    out.append(("hidden-mid-spiral", "hidden", make(spiral(151))))
    # 最大: 1000×1000 の蛇行（1 本道 500,499 マス）。再帰 DFS は深さ約 5×10^5 で Python・Node・C・Rust のスタックが尽きる
    out.append(("hidden-max-serpentine", "hidden", make(serpentine(1000, 1000))))
    # 最大: 全部空き（10^6 マスが 1 つのまとまり）
    out.append(("hidden-max-all-free", "hidden", make(["." * 1000] * 1000)))
    # 最大: 市松模様（50 万個のまとまり。まとまりごとの初期化が重い実装は遅くなる）
    out.append(("hidden-max-checker", "hidden", make([(".#" * 500) if r % 2 == 0 else ("#." * 500) for r in range(1000)])))
    out.append(("hidden-max-random", "hidden", make(random_rows(rng, 1000, 1000, 42))))
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
