#!/usr/bin/env python3
"""cp-0011 映画館の連続空席 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0011 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解。行ごとに「いま続いている空席の数」を数え、K に達した時点で答えが決まる。行が変わったら 0 に戻す"""
    lines = inp.split("\n")
    h, w, k = map(int, lines[0].split())
    for r in range(h):
        run = 0
        row = lines[1 + r]
        for c in range(w):
            if row[c] == ".":
                run += 1
                if run == k:
                    return f"{r + 1} {c - k + 2}\n"
            else:
                run = 0
    return "-1\n"


def make(h: int, w: int, k: int, rows: list[str]) -> str:
    assert len(rows) == h and all(len(s) == w and set(s) <= {".", "#"} for s in rows) and 1 <= k <= w
    return f"{h} {w} {k}\n" + "".join(s + "\n" for s in rows)


def random_rows(rng: SplitMix64, h: int, w: int, free_pct: int) -> list[str]:
    return ["".join("." if rng.randint(1, 100) <= free_pct else "#" for _ in range(w)) for _ in range(h)]


def random_small(rng: SplitMix64) -> str:
    h, w = rng.randint(1, 4), rng.randint(1, 8)
    k = rng.randint(1, w)
    return make(h, w, k, random_rows(rng, h, w, rng.choice([30, 60, 80, 95])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def runs_row(rng: SplitMix64, w: int, maxrun: int) -> str:
    """空席の連続がどこも maxrun 以下になる長さ w の行（連続の長さは 1〜maxrun、間は 1 席の予約済み）"""
    cells: list[str] = []
    while len(cells) < w:
        cells += ["."] * rng.randint(1, maxrun)
        cells.append("#")
    return "".join(cells[:w])


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3 6 3\n..#..#\n#...##\n......\n"))
    out.append(("sample-2-row-end", "sample", "2 5 2\n#.#..\n.....\n"))
    out.append(("sample-3-none", "sample", "3 4 3\n.#..\n#..#\n..#.\n"))
    rng = SplitMix64(0x5EED_0011)
    out.append(("hidden-min-free", "hidden", make(1, 1, 1, ["."])))
    out.append(("hidden-min-full", "hidden", make(1, 1, 1, ["#"])))
    # 行末で K に達する空席だけが答え（「# を見たときだけ長さを確かめる」書き方は見落とす）
    rows = [runs_row(rng, 12, 3) for _ in range(5)] + ["#.##.#..####", "##.#.##....."]
    out.append(("hidden-trap-row-end", "hidden", make(7, 12, 4, rows)))
    # 行をまたぐと K 席になる（行が変わってもカウントを 0 に戻さないと 1 行目を答えにしてしまう）。本当の答えは 6 行目
    rows = ["#..#.##...", "...#.#..#.", "#.#.#.#.#.", "..#..#..#.", ".#..#..#..", "#....#..#.", "..........", ".........."]
    out.append(("hidden-trap-row-reset", "hidden", make(8, 10, 4, rows)))
    rows = ["#.#.##.#..", "..#.#.#.#.", "..#..#.#..", ".#.##.#..#"]
    out.append(("hidden-trap-row-reset-none", "hidden", make(4, 10, 3, rows)))
    rows = ["......#...", "#.........", "..........", ".....#...."]
    out.append(("hidden-trap-k-equals-w", "hidden", make(4, 10, 10, rows)))
    out.append(("hidden-trap-k1", "hidden", make(3, 6, 1, ["######", "#####.", "......"])))
    out.append(("hidden-edge-none-all-short", "hidden", make(6, 20, 5, [runs_row(rng, 20, 4) for _ in range(6)])))
    for i in range(3):
        h, w = rng.randint(3, 10), rng.randint(3, 15)
        k = rng.randint(2, min(w, 5))
        out.append((f"hidden-rand-{i + 1}", "hidden", make(h, w, k, random_rows(rng, h, w, 70))))
    out.append(("hidden-mid-1", "hidden", make(40, 60, 7, [runs_row(rng, 60, 6) for _ in range(30)] + random_rows(rng, 10, 60, 85))))
    # 最大: 100×100。答えは最後の行の行末だけ（ほかは 49 席までの連続。行をまたぐと 50 席以上になる所もある）
    rows = [runs_row(rng, 100, 49) for _ in range(99)] + [runs_row(rng, 49, 49) + "#" + "." * 50]
    out.append(("hidden-max-last-row-end", "hidden", make(100, 100, 50, rows)))
    # 最大: 100×100、K=W=100。どの行にも 1 つだけ予約済みがある → -1
    rows = []
    for r in range(100):
        c = rng.randint(0, 99)
        rows.append("." * c + "#" + "." * (99 - c))
    out.append(("hidden-max-none-k-equals-w", "hidden", make(100, 100, 100, rows)))
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
