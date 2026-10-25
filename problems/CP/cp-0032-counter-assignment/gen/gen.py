#!/usr/bin/env python3
"""cp-0032 窓口の割り当て のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0032 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: 窓口ごとに「空く時刻」を持ち、客ごとに M 個を走査する O(NM)。
    案内時刻 s = max(到着, 最も早く空く時刻)。s の時点で空いている（空く時刻 ≤ s）窓口のうち番号最小を使う"""
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    free = [0] * m
    out = []
    for i in range(n):
        a, d = tok[2 + 2 * i], tok[3 + 2 * i]
        s = max(a, min(free))
        for k in range(m):
            if free[k] <= s:
                break
        free[k] = s + d
        out.append(f"{k + 1} {s - a}")
    return "\n".join(out) + "\n"


def render(m: int, cust: list[tuple[int, int]]) -> str:
    return f"{len(cust)} {m}\n" + "".join(f"{a} {d}\n" for a, d in cust)


def random_cust(rng: SplitMix64, n: int, amax: int, dmax: int) -> list[tuple[int, int]]:
    arr = sorted(rng.randint(0, amax) for _ in range(n))
    return [(a, rng.randint(1, dmax)) for a in arr]


def random_small(rng: SplitMix64) -> str:
    """到着 0〜20・所要 1〜6 の小さい値（同時刻の到着と、到着ちょうどに空く窓口が頻繁に起きる）"""
    m = rng.randint(1, 4)
    n = rng.randint(1, 9)
    return render(m, random_cust(rng, n, 20, 6))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "5 2\n0 5\n1 3\n2 4\n4 2\n4 1\n"))
    out.append(("sample-2", "sample", "3 2\n0 3\n0 3\n1 2\n"))
    rng = SplitMix64(0x5EED_0032)
    out.append(("hidden-min-1", "hidden", "1 1\n7 3\n"))
    out.append(("hidden-edge-more-windows", "hidden", render(10, [(5, 2), (5, 9), (5, 1)])))
    # 到着と同時に空いた窓口は使える: 空く時刻 < 到着 で判定すると、番号の大きい別の空き窓口へ回してしまう
    out.append(("hidden-trap-free-at-arrival", "hidden", render(3, [(0, 5), (0, 1), (0, 2), (5, 4), (5, 4), (9, 1), (9, 1)])))
    # 空いている窓口が複数あるときは番号最小。(空く時刻, 番号) のヒープで「最も前に空いた窓口」を選ぶと WA
    out.append(("hidden-trap-idle-lowest", "hidden", render(4, [(0, 9), (0, 2), (0, 5), (0, 1), (20, 3), (21, 3), (22, 3), (100, 1)])))
    # 同時刻の到着は入力順に並ぶ。全員が待つ場面で、同時に空く窓口は番号が小さい方から
    out.append(("hidden-trap-same-time-order", "hidden", render(3, [(0, 4), (0, 4), (0, 4), (1, 7), (1, 2), (1, 5), (1, 1), (4, 3), (4, 3)])))
    # 時刻・待ち時間は 32bit を超える（窓口 1 つに 10^9 分の手続きが並ぶ）
    out.append(("hidden-trap-int64", "hidden", render(1, [(0, 10 ** 9)] * 5 + [(10 ** 9, 10 ** 9)] * 3)))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_small(rng)))
    out.append(("hidden-mid-1", "hidden", render(5, random_cust(rng, 2000, 10 ** 5, 300))))
    # 最大: N=2×10^4、M=10。混み具合がちょうど釣り合う程度に到着を散らす
    n = 20000
    out.append(("hidden-max-random", "hidden", render(10, random_cust(rng, n, 10 ** 9, 10 ** 6))))
    # 最大: 窓口 1 つに全員が時刻 0 に並び、所要 10^9（最後の客の待ち時間は約 2×10^13）
    out.append(("hidden-max-int64", "hidden", render(1, [(0, 10 ** 9)] * n)))
    # 最大: 同時刻の到着がまとまって来る（ほぼ全員が待つ。同時に空く窓口が多い）
    burst = []
    for b in range(n // 50):
        t = b * 1000
        burst += [(t, rng.choice([100, 200, 300])) for _ in range(50)]
    out.append(("hidden-max-bursts", "hidden", render(10, burst)))
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
