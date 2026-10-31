#!/usr/bin/env python3
"""cp-0039 和が M の倍数になるペア のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0039 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: 左から見て、余り r の袋と組めるのは余り (M − r) mod M の袋。それまでに見た個数を辞書で数える"""
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    cnt: dict[int, int] = {}
    ans = 0
    for x in tok[2 : 2 + n]:
        r = x % m
        ans += cnt.get((m - r) % m, 0)
        cnt[r] = cnt.get(r, 0) + 1
    return f"{ans}\n"


def render(m: int, a: list[int]) -> str:
    return f"{len(a)} {m}\n{' '.join(map(str, a))}\n"


def random_small(rng: SplitMix64) -> str:
    """N ≤ 12、M は 1〜8（偶数の M/2 と余り 0 が頻繁に出る）"""
    n = rng.randint(2, 12)
    m = rng.randint(1, 8)
    return render(m, [rng.randint(1, 30) for _ in range(n)])


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "5 4\n1 3 2 6 4\n"))
    out.append(("sample-2", "sample", "4 5\n5 10 15 20\n"))
    out.append(("sample-3-none", "sample", "3 10\n1 2 3\n"))
    rng = SplitMix64(0x5EED_0039)
    out.append(("hidden-min-yes", "hidden", "2 7\n3 4\n"))
    out.append(("hidden-min-no", "hidden", "2 7\n3 3\n"))
    # M が偶数のとき余り M/2 どうしの組: cnt[r] × cnt[M−r] で数えると自分自身とも組んで二重に数える
    out.append(("hidden-trap-half-residue", "hidden", render(10, [5, 15, 25, 35, 45, 3, 7, 12, 8, 105])))
    # 余り 0 どうしの組（c(c−1)/2）
    out.append(("hidden-trap-zero-residue", "hidden", render(6, [6, 12, 18, 24, 1, 5, 30, 36, 2])))
    # M = 1: すべての組が条件を満たす
    out.append(("hidden-trap-m-one", "hidden", render(1, [rng.randint(1, 10 ** 9) for _ in range(1000)])))
    # M = 10^9: 余りごとの配列を大きさ M で取ると MLE / 遅い。A_i + A_j も 32bit を超える
    out.append(("hidden-trap-large-m", "hidden", render(10 ** 9, [rng.choice([1, 999999999, 500000000, 10 ** 9, 2, 999999998, 123456789, 876543211]) for _ in range(2000)])))
    # 答えが 32bit を超える: 10^5 袋がすべて 3 の倍数（M=3）で C(10^5, 2) ≈ 5×10^9
    out.append(("hidden-trap-int64", "hidden", render(3, [3 * rng.randint(1, 3000) for _ in range(100000)])))
    for i in range(3):
        nn = rng.randint(10, 60)
        mm = rng.randint(2, 40)
        out.append((f"hidden-rand-{i + 1}", "hidden", render(mm, [rng.randint(1, 10 ** 9) for _ in range(nn)])))
    a = [rng.randint(1, 10 ** 9) for _ in range(5000)]
    out.append(("hidden-mid-1", "hidden", render(1000, a)))
    n = 200000
    # 最大: M=7 で全員が 7 の倍数。答えは N(N−1)/2 ≈ 2×10^10（32bit を超える）
    out.append(("hidden-max-all-pairs", "hidden", render(7, [7 * rng.randint(1, 1400) for _ in range(n)])))
    # 最大: M = 2000、ほとんどが余り 1000（M/2）
    out.append(("hidden-max-half", "hidden", render(2000, [1000 + 2000 * rng.randint(0, 499) if rng.randint(0, 9) else rng.randint(1, 10 ** 6) for _ in range(n)])))
    # 最大: M は大きめのランダム、A はランダム
    out.append(("hidden-max-random", "hidden", render(99991, [rng.randint(1, 10 ** 9) for _ in range(n)])))
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
