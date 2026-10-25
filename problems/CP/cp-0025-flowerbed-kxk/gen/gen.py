#!/usr/bin/env python3
"""cp-0025 花壇の K×K 区画 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0025 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解（2 次元累積和）。S[i][j] = 上 i 行・左 j 列の合計。各区画の合計を O(1) で出し、行優先で最初の最大を取る"""
    lines = inp.split("\n")
    h, w, k = map(int, lines[0].split())
    S = [[0] * (w + 1)]
    for i in range(h):
        prev = S[-1]
        row = [0] * (w + 1)
        acc = 0
        g = lines[1 + i]
        for j in range(w):
            acc += ord(g[j]) - 48
            row[j + 1] = prev[j + 1] + acc
        S.append(row)
    best, br, bc = -1, 0, 0
    for r in range(h - k + 1):
        top, bot = S[r], S[r + k]
        for c in range(w - k + 1):
            v = bot[c + k] - top[c + k] - bot[c] + top[c]
            if v > best:  # 行優先で見て「より大きいとき」だけ更新 → 同点は上・左が残る
                best, br, bc = v, r, c
    return f"{best}\n{br + 1} {bc + 1}\n"


def fmt(k: int, grid: list[str]) -> str:
    return f"{len(grid)} {len(grid[0])} {k}\n" + "".join(g + "\n" for g in grid)


def random_grid(rng: SplitMix64, h: int, w: int, digits: str = "0123456789") -> list[str]:
    return ["".join(rng.choice(digits) for _ in range(w)) for _ in range(h)]


def random_small(rng: SplitMix64) -> str:
    h, w = rng.randint(1, 6), rng.randint(1, 6)
    k = rng.randint(1, min(h, w))
    return fmt(k, random_grid(rng, h, w, rng.choice(["01", "0123456789", "09", "5"])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3 4 2\n1203\n0450\n9101\n"))
    out.append(("sample-2-tie", "sample", "3 3 2\n090\n000\n009\n"))
    out.append(("sample-3-k-equals-size", "sample", "2 2 2\n12\n34\n"))
    rng = SplitMix64(0x5EED_0025)

    out.append(("hidden-min-1", "hidden", "1 1 1\n0\n"))
    # 全部 0: 「より大きいとき更新」で初期値 0 だと位置が 1 回も入らない
    out.append(("hidden-trap-all-zero", "hidden", fmt(5, ["0" * 50] * 40)))
    # 同点の優先: (2,1) と (1,5) が同じ最大。列優先で走査すると (2,1) を選んでしまう
    g = [list("0" * 8) for _ in range(6)]
    for r, c in ((1, 0), (0, 4)):
        for dr in range(3):
            for dc in range(3):
                g[r + dr][c + dc] = "9"
    out.append(("hidden-trap-tie-row-first", "hidden", fmt(3, ["".join(x) for x in g])))
    # 最大が右下の隅（ループの上限を H−K / W−K までにすると取りこぼす）
    g = random_grid(rng, 300, 400, "012")
    g = [row[:-30] + "9" * 30 if i >= 270 else row for i, row in enumerate(g)]
    out.append(("hidden-trap-bottom-right", "hidden", fmt(30, g)))
    out.append(("hidden-trap-k-equals-size", "hidden", fmt(300, random_grid(rng, 300, 300))))
    # K = 1: 9 が 1 マスだけ（盤面の中ほど）
    g = [list(row) for row in random_grid(rng, 200, 200, "012345678")]
    g[rng.randint(50, 150)][rng.randint(50, 150)] = "9"
    out.append(("hidden-edge-k1", "hidden", fmt(1, ["".join(x) for x in g])))
    # 1 行だけ: 9 が 2 か所あり、左の方を答える
    row = list(random_grid(rng, 1, 1000, "012345678")[0])
    row[rng.randint(100, 400)] = row[rng.randint(500, 900)] = "9"
    out.append(("hidden-edge-one-row", "hidden", fmt(1, ["".join(row)])))
    out.append(("hidden-edge-wide", "hidden", fmt(7, random_grid(rng, 7, 900))))
    for i in range(3):
        h, w = rng.randint(5, 30), rng.randint(5, 30)
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(rng.randint(1, min(h, w)), random_grid(rng, h, w))))
    out.append(("hidden-mid-1", "hidden", fmt(37, random_grid(rng, 120, 150))))
    # 最大: 1000×1000、K = 500（各区画を足し直すと 501^2 × 500^2 ≈ 6.3×10^10）
    out.append(("hidden-max-k500", "hidden", fmt(500, random_grid(rng, 1000, 1000))))
    # 最大: 全マス 9 で全区画が同点 → 1 1。K = 300
    out.append(("hidden-max-all-tie", "hidden", fmt(300, ["9" * 1000] * 1000)))
    # 最大: 下ほど花が多い（最大は最終行付近、同じ合計が横に並ぶ）
    g = ["".join(rng.choice("0123456789"[: 1 + min(9, i // 100)]) for _ in range(1000)) for i in range(1000)]
    out.append(("hidden-max-gradient", "hidden", fmt(250, g)))
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
