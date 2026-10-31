#!/usr/bin/env python3
"""cp-0037 予算内の最長連続日程 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0037 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: 尺取り法。右端 r を 1 つずつ伸ばし、合計が B を超えている間は左端を進める"""
    tok = list(map(int, inp.split()))
    n, b = tok[0], tok[1]
    a = tok[2 : 2 + n]
    best_len, best_l = 0, 0
    s = 0
    l = 0
    for r in range(n):
        s += a[r]
        while s > b:
            s -= a[l]
            l += 1
        if r - l + 1 > best_len:  # 同じ長さなら更新しない（最も早い開始日を残す）
            best_len, best_l = r - l + 1, l + 1
    return "0\n" if best_len == 0 else f"{best_len} {best_l}\n"


def render(b: int, a: list[int]) -> str:
    return f"{len(a)} {b}\n{' '.join(map(str, a))}\n"


def random_small(rng: SplitMix64) -> str:
    """N ≤ 10、費用 0〜9、予算 1〜25（0 円の日・予算超えの日・同じ長さの区間が頻繁に出る）"""
    n = rng.randint(1, 10)
    a = [rng.randint(0, 9) for _ in range(n)]
    return render(rng.randint(1, 25), a)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "7 10\n3 1 4 1 5 9 2\n"))
    out.append(("sample-2-none", "sample", "3 5\n6 7 8\n"))
    rng = SplitMix64(0x5EED_0037)
    out.append(("hidden-min-fit", "hidden", "1 5\n5\n"))
    out.append(("hidden-min-none", "hidden", "1 4\n5\n"))
    out.append(("hidden-edge-all-fit", "hidden", render(100, [3, 0, 7, 2, 9, 1])))
    # 最長が複数: 最も早い開始日（≥ で更新すると最後の開始日になる）
    out.append(("hidden-trap-earliest-start", "hidden", render(6, [5, 1, 2, 3, 9, 3, 2, 1, 9, 2, 2, 2, 7, 1, 1, 4])))
    # 0 円の日を含む（合計が増えない日が続いても区間は伸ばせる）
    out.append(("hidden-trap-zero-cost", "hidden", render(3, [0, 0, 5, 0, 1, 0, 2, 0, 0, 0, 4, 0, 0, 3, 0])))
    # 予算 10^15・合計は 32bit を超える（予算を int で読むと壊れる）
    out.append(("hidden-trap-int64", "hidden", render(5 * 10 ** 12, [10 ** 9] * 10000)))
    # どの日も予算を超える（N > 1）
    out.append(("hidden-edge-all-over", "hidden", render(10 ** 9 - 1, [10 ** 9] * 50)))
    for i in range(3):
        n = rng.randint(10, 40)
        a = [rng.randint(0, 30) for _ in range(n)]
        out.append((f"hidden-rand-{i + 1}", "hidden", render(rng.randint(10, 200), a)))
    a = [rng.randint(0, 10 ** 6) for _ in range(5000)]
    out.append(("hidden-mid-1", "hidden", render(sum(a) // 7, a)))
    n = 200000
    # 最大: 全日程が予算内（O(N^2) の素朴解は毎回末尾まで足し続ける）
    a = [rng.randint(0, 999) for _ in range(n)]
    out.append(("hidden-max-all-fit", "hidden", render(10 ** 15, a)))
    # 最大: 最長はおよそ N/2 日。費用は 10^9 まで
    a = [rng.randint(0, 10 ** 9) for _ in range(n)]
    out.append(("hidden-max-half", "hidden", render(sum(a) // 2, a)))
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
