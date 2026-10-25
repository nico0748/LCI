#!/usr/bin/env python3
"""cp-0030 クールダウン付きのタイムセール のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0030 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解（1 次元 DP）。dp[i] = 店 1..i だけで得られる最大。dp[i] = max(dp[i−1], dp[i−D] + a_i)（i−D ≤ 0 なら 0）"""
    t = list(map(int, inp.split()))
    n, d = t[0], t[1]
    a = t[2 : 2 + n]
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        take = a[i - 1] + (dp[i - d] if i - d >= 0 else 0)
        dp[i] = max(dp[i - 1], take)
    return f"{dp[n]}\n"


def fmt(d: int, a: list[int]) -> str:
    return f"{len(a)} {d}\n" + " ".join(map(str, a)) + "\n"


def greedy(inp: str) -> int:
    """割引の大きい順に、間隔 D 未満の店と重ならない限り取る貪欲（罠のケースを選ぶのに使う）"""
    t = list(map(int, inp.split()))
    n, d = t[0], t[1]
    a = t[2 : 2 + n]
    taken: list[int] = []
    for i in sorted(range(n), key=lambda i: (-a[i], i)):
        if all(abs(i - j) >= d for j in taken):
            taken.append(i)
    return sum(a[i] for i in taken)


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 10)
    d = rng.choice([1, 2, 3, rng.randint(1, 12), 10**9])
    return fmt(d, [rng.randint(1, rng.choice([3, 10, 10**9])) for _ in range(n)])


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1-greedy", "sample", "6 2\n5 6 5 1 9 8\n"))
    out.append(("sample-2-d-gt-n", "sample", "3 5\n2 9 4\n"))
    out.append(("sample-3-d1", "sample", "4 1\n1000000000 1000000000 1000000000 1000000000\n"))
    rng = SplitMix64(0x5EED_0030)

    out.append(("hidden-min-1", "hidden", "1 1\n7\n"))
    out.append(("hidden-edge-d-equals-n", "hidden", fmt(50, [rng.randint(1, 1000) for _ in range(50)])))
    # 大きい順の貪欲が負ける形（真ん中が少しだけ大きい 3 つ組）を並べる
    a = []
    for _ in range(300):
        x = rng.randint(100, 1000)
        a += [x, x + rng.randint(1, x - 1), x]
    inp = fmt(2, a)
    assert greedy(inp) < int(solve(inp))
    out.append(("hidden-trap-greedy", "hidden", inp))
    # D = 3 でも貪欲が負ける（1 つ大きい店を取ると、両側の 2 店ずつが使えなくなる）
    while True:
        inp = fmt(3, [rng.randint(1, 20) for _ in range(40)])
        if greedy(inp) < int(solve(inp)):
            break
    out.append(("hidden-trap-greedy-d3", "hidden", inp))
    out.append(("hidden-trap-d1", "hidden", fmt(1, [rng.randint(1, 10**9) for _ in range(1000)])))
    out.append(("hidden-trap-d-gt-n", "hidden", fmt(10**9, [rng.randint(1, 10**9) for _ in range(1000)])))
    # 和が 2^31 を超える（D = 2、10^4 店すべて 10^9）
    out.append(("hidden-trap-int64", "hidden", fmt(2, [10**9] * 10000)))
    # i − D がちょうど 0 になる（1 店目と D+1 店目の両方を取るのが最適）
    out.append(("hidden-trap-index-boundary", "hidden", fmt(4, [10, 1, 1, 1, 10, 1, 1, 1, 10])))
    for i in range(3):
        n = rng.randint(10, 40)
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(rng.randint(1, 8), [rng.randint(1, 100) for _ in range(n)])))
    out.append(("hidden-mid-1", "hidden", fmt(37, [rng.randint(1, 10**9) for _ in range(5000)])))
    # 最大: D = 1、全店 10^9（答え 2×10^14）。dp[i] を「i−D 以前の最大」を毎回探して作る O(N^2) は TLE
    out.append(("hidden-max-d1", "hidden", fmt(1, [10**9] * 200000)))
    out.append(("hidden-max-d2", "hidden", fmt(2, [rng.randint(1, 10**6) for _ in range(200000)])))
    out.append(("hidden-max-d-large", "hidden", fmt(50000, [rng.randint(1, 999) for _ in range(200000)])))
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
