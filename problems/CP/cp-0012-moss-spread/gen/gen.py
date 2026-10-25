#!/usr/bin/env python3
"""cp-0012 苔の広がり のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0012 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


def step(g: list[list[str]], h: int, w: int) -> list[list[str]]:
    """1 日分。前の日の盤面 g だけを見て、新しい盤面を別に作る（二重バッファ）"""
    nxt = [row[:] for row in g]
    for r in range(h):
        for c in range(w):
            ch = g[r][c]
            if ch == "#":
                continue
            m = 0
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
    return nxt


def solve(inp: str) -> str:
    """想定解。T 回、二重バッファで盤面を更新する。O(T·H·W)"""
    lines = inp.split("\n")
    h, w, t = map(int, lines[0].split())
    g = [list(lines[1 + r]) for r in range(h)]
    for _ in range(t):
        g = step(g, h, w)
    return "".join("".join(row) + "\n" for row in g)


def make(h: int, w: int, t: int, rows: list[str]) -> str:
    assert len(rows) == h and all(len(s) == w and set(s) <= {".", "o", "#"} for s in rows)
    return f"{h} {w} {t}\n" + "".join(s + "\n" for s in rows)


def random_rows(rng: SplitMix64, h: int, w: int, moss: int, rock: int) -> list[str]:
    def cell() -> str:
        x = rng.randint(1, 100)
        return "o" if x <= moss else "#" if x <= moss + rock else "."
    return ["".join(cell() for _ in range(w)) for _ in range(h)]


def random_small(rng: SplitMix64) -> str:
    h, w = rng.randint(1, 5), rng.randint(1, 5)
    return make(h, w, rng.randint(0, 6), random_rows(rng, h, w, rng.choice([20, 40, 60, 90]), rng.choice([0, 10, 25])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3 4 1\n.o..\noo.o\n..#.\n"))
    out.append(("sample-2", "sample", "4 5 3\n.o...\nooo..\n.o.#.\n.....\n"))
    out.append(("sample-3-t0", "sample", "2 3 0\no.o\n#o.\n"))
    rng = SplitMix64(0x5EED_0012)
    out.append(("hidden-min-1x1", "hidden", make(1, 1, 5, ["o"])))
    out.append(("hidden-min-1xw", "hidden", make(1, 7, 2, [".o.oo.o"])))
    out.append(("hidden-edge-t0", "hidden", make(6, 8, 0, random_rows(rng, 6, 8, 40, 10))))
    out.append(("hidden-edge-all-rock", "hidden", make(3, 4, 7, ["####"] * 3)))
    out.append(("hidden-edge-all-moss", "hidden", make(5, 6, 1, ["oooooo"] * 5)))
    # その場で更新すると、同じ日に苔になったマスがすぐ右・下の判定に効いてしまう
    out.append(("hidden-trap-inplace-1day", "hidden", make(8, 8, 1, random_rows(rng, 8, 8, 35, 5))))
    out.append(("hidden-trap-inplace-many-days", "hidden", make(12, 15, 20, random_rows(rng, 12, 15, 30, 10))))
    # 端: 上端と下端・左端と右端に苔を置く。Python の g[r-1]（r=0 で -1 = 最後の行）や、盤の外を苔と数える誤りで結果が変わる
    rows = ["o.oo.o", "......", "o....o", "......", ".o..o.", "oo..oo"]
    out.append(("hidden-trap-edge-wrap", "hidden", make(6, 6, 2, rows)))
    rows = ["ooooooo", "o.....o", "o.#.#.o", "o.....o", "ooooooo"]
    out.append(("hidden-trap-edge-border", "hidden", make(5, 7, 3, rows)))
    for i in range(3):
        h, w = rng.randint(4, 12), rng.randint(4, 12)
        out.append((f"hidden-rand-{i + 1}", "hidden", make(h, w, rng.randint(1, 15), random_rows(rng, h, w, rng.choice([20, 35, 50]), rng.choice([0, 10])))))
    out.append(("hidden-mid-1", "hidden", make(25, 40, 50, random_rows(rng, 25, 40, 25, 8))))
    out.append(("hidden-max-random", "hidden", make(50, 50, 100, random_rows(rng, 50, 50, 30, 5))))
    rows = ["".join("#" if (r % 6 == 3 and c % 7 != 2) else "." for c in range(50)) for r in range(50)]
    rows[0] = "o" * 50
    out.append(("hidden-max-rock-rows", "hidden", make(50, 50, 100, rows)))
    out.append(("hidden-max-all-moss-odd", "hidden", make(50, 50, 99, ["o" * 50] * 50)))
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
