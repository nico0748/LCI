#!/usr/bin/env python3
"""cp-0036 冷蔵品つきの積み込み のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0036 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: dp[c][w] = 冷蔵品 c 個以下・重さ w 以下で得られる報酬の最大。荷物ごとに前の表から新しい表を作る（0/1）"""
    tok = list(map(int, inp.split()))
    n, cap, cmax = tok[0], tok[1], tok[2]
    dp = [[0] * (cap + 1) for _ in range(cmax + 1)]
    for i in range(n):
        w, v, f = tok[3 + 3 * i], tok[4 + 3 * i], tok[5 + 3 * i]
        if w > cap:
            continue
        if f == 0:
            for c in range(cmax + 1):
                row = dp[c]
                dp[c] = row[:w] + [x if x >= y + v else y + v for x, y in zip(row[w:], row)]
        else:
            for c in range(cmax, 0, -1):  # 冷蔵品は 1 段下（c−1）の表から足す。c=0 には入れられない
                row, low = dp[c], dp[c - 1]
                dp[c] = row[:w] + [x if x >= y + v else y + v for x, y in zip(row[w:], low)]
    return f"{dp[cmax][cap]}\n"


def render(cap: int, cmax: int, items: list[tuple[int, int, int]]) -> str:
    return f"{len(items)} {cap} {cmax}\n" + "".join(f"{w} {v} {f}\n" for w, v, f in items)


def random_items(rng: SplitMix64, n: int, wmax: int, vmax: int, pcold: int) -> list[tuple[int, int, int]]:
    return [(rng.randint(1, wmax), rng.randint(1, vmax), 1 if rng.randint(1, 100) <= pcold else 0) for _ in range(n)]


def random_small(rng: SplitMix64) -> str:
    """荷物 1〜12 個（brute は 2^12 通り）。重さ・上限は小さく、冷蔵品は半分程度"""
    n = rng.randint(1, 12)
    cap = rng.randint(1, 30)
    cmax = rng.randint(0, 5)
    return render(cap, cmax, random_items(rng, n, 15, 50, 50))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 10 1\n4 50 1\n5 60 1\n3 30 0\n6 45 0\n"))
    out.append(("sample-2", "sample", "3 5 0\n2 10 1\n6 100 0\n5 7 0\n"))
    rng = SplitMix64(0x5EED_0036)
    out.append(("hidden-min-1", "hidden", render(1, 0, [(1, 5, 0)])))
    out.append(("hidden-edge-nothing-fits", "hidden", render(9, 5, [(10, 100, 0), (2000, 7, 1), (15, 3, 0)])))
    # 重さの昇順に dp を更新すると同じ荷物を何度も使ってしまう（個数制限なしのナップサックになる）
    out.append(("hidden-trap-reuse-item", "hidden", render(10, 2, [(5, 100, 0), (3, 1, 0), (2, 70, 1)])))
    # 冷蔵品の個数制限: 価値の高い冷蔵品が多くても C 個まで
    out.append(("hidden-trap-cold-limit", "hidden", render(30, 2, [(3, 90, 1), (4, 95, 1), (5, 99, 1), (2, 80, 1), (10, 60, 0), (12, 55, 0), (8, 30, 0)])))
    # C=0: 冷蔵品は 1 つも積めない
    out.append(("hidden-trap-c-zero", "hidden", render(20, 0, [(1, 1000, 1), (2, 999, 1), (10, 50, 0), (11, 49, 0), (9, 48, 0)])))
    # 報酬/重さの比で貪欲に積むと WA（比が最大の荷物が上限を中途半端に埋める）
    out.append(("hidden-trap-greedy-ratio", "hidden", render(100, 3, [(51, 520, 0), (50, 495, 0), (50, 495, 0), (1, 5, 1), (49, 400, 1)])))
    # 合計報酬は 10^11 程度（32bit を超える）
    out.append(("hidden-trap-int64", "hidden", render(2000, 5, [(20, 10 ** 9 - i, i % 2) for i in range(100)])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_small(rng)))
    out.append(("hidden-mid-1", "hidden", render(500, 3, random_items(rng, 40, 100, 10 ** 6, 40))))
    # 最大: N=100、W=2000、C=5。重さはばらばら
    out.append(("hidden-max-random", "hidden", render(2000, 5, random_items(rng, 100, 2000, 10 ** 9, 50))))
    # 最大: 軽い荷物ばかりで多くが積める（全探索は 2^100、比の貪欲は端数で負ける）
    out.append(("hidden-max-light-items", "hidden", render(2000, 3, random_items(rng, 100, 60, 10 ** 9, 30))))
    # 最大: 全部が冷蔵品、C=5（冷蔵の次元が効く）
    out.append(("hidden-max-all-cold", "hidden", render(2000, 5, random_items(rng, 100, 700, 10 ** 9, 100))))
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
