#!/usr/bin/env python3
"""cp-0003 本棚 K 段の最小の棚幅 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0003 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
sys.dont_write_bytecode = True  # gen/__pycache__ を作らない（.gitignore に無いため）
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

def shelves_needed(w: list[int], cap: int) -> int:
    """棚幅 cap のとき、左から詰めていくと何段要るか（cap ≥ max(w) が前提）"""
    count, cur = 1, 0
    for x in w:
        if cur + x > cap:
            count += 1
            cur = x
        else:
            cur += x
    return count


def solve(inp: str) -> str:
    """想定解。答え（棚幅）で二分探索し、判定は左から貪欲に詰める。O(N log ΣW)"""
    tok = inp.split()
    n, k = int(tok[0]), int(tok[1])
    w = list(map(int, tok[2 : 2 + n]))
    lo, hi = max(w), sum(w)  # 答えは [max(w), sum(w)] にある。sum は最大 2×10^14
    while lo < hi:
        mid = (lo + hi) // 2
        if shelves_needed(w, mid) <= k:
            hi = mid
        else:
            lo = mid + 1
    return f"{lo}\n"


def render(k: int, w: list[int]) -> str:
    return f"{len(w)} {k}\n" + " ".join(map(str, w)) + "\n"


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 8)
    w = [rng.randint(1, rng.choice([3, 20, 100])) for _ in range(n)]
    if rng.randint(0, 3) == 0:
        w[rng.randint(0, n - 1)] = rng.randint(50, 300)  # 1 冊だけ極端に広い
    return render(rng.randint(1, 10), w)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", render(2, [3, 1, 4, 1, 5])))
    out.append(("sample-2-k-ge-n", "sample", render(5, [2, 7, 1])))
    out.append(("sample-3", "sample", render(3, [5, 2, 7, 3, 6, 1, 4, 8])))
    rng = SplitMix64(0x5EED_0003)
    out.append(("hidden-min-1", "hidden", render(1, [1])))
    out.append(("hidden-edge-k1", "hidden", render(1, [rng.randint(1, 1000) for _ in range(10)])))
    out.append(("hidden-trap-wide-book", "hidden", render(3, [1, 1, 1, 100, 1, 1])))
    w = [rng.randint(1, 1000) for _ in range(1000)]
    w[617] = 10**9
    out.append(("hidden-trap-wide-book-2", "hidden", render(5, w)))
    out.append(("hidden-trap-k-ge-n", "hidden", render(200000, [rng.randint(1, 10**9) for _ in range(50)])))
    out.append(("hidden-trap-k-eq-n", "hidden", render(30, [rng.randint(1, 10**6) for _ in range(30)])))
    out.append(("hidden-trap-overflow", "hidden", render(1, [10**9] * 5)))
    out.append(("hidden-trap-overflow-2", "hidden", render(2, [10**9] * 7)))
    for i in range(4):
        n = rng.randint(10, 50)
        out.append((f"hidden-rand-{i + 1}", "hidden", render(rng.randint(1, n), [rng.randint(1, 100) for _ in range(n)])))
    out.append(("hidden-mid-1", "hidden", render(37, [rng.randint(1, 10**6) for _ in range(10000)])))
    # 最大: 答えが 10^14 近くになり、幅を 1 ずつ試す素朴解は終わらない
    out.append(("hidden-max-k2", "hidden", render(2, [rng.randint(1, 10**9) for _ in range(200000)])))
    # 全部同じ厚さ（各段の幅がちょうど棚幅に一致する境界）。答えは 66667×7 で、1 ずつ試す素朴解は約 4.7×10^5 回の判定
    out.append(("hidden-max-all-equal", "hidden", render(3, [7] * 200000)))
    out.append(("hidden-max-many-shelves", "hidden", render(50000, [rng.randint(1, 100) for _ in range(200000)])))
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
