#!/usr/bin/env python3
"""cp-0009 くじ引きの組合せ数 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0009 --naive` で hidden-max-* のどれかが TLE することを確かめる
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

P = 998244353


def solve(inp: str) -> str:
    """想定解。n の最大値まで階乗と階乗の逆元（フェルマー: a^(P−2)）を前計算し、各クエリ O(1)"""
    tok = inp.split()
    q = int(tok[0])
    qs = [(int(tok[1 + 2 * i]), int(tok[2 + 2 * i])) for i in range(q)]
    m = max(n for n, _ in qs)
    fact = [1] * (m + 1)
    for i in range(1, m + 1):
        fact[i] = fact[i - 1] * i % P
    inv = [1] * (m + 1)
    inv[m] = pow(fact[m], P - 2, P)
    for i in range(m, 0, -1):
        inv[i - 1] = inv[i] * i % P
    res = []
    for n, r in qs:
        res.append(0 if r > n else fact[n] * inv[r] % P * inv[n - r] % P)
    return "\n".join(map(str, res)) + "\n"


def render(qs: list[tuple[int, int]]) -> str:
    return f"{len(qs)}\n" + "".join(f"{n} {r}\n" for n, r in qs)


def random_small(rng: SplitMix64) -> str:
    return render([(rng.randint(0, 30), rng.randint(0, 35)) for _ in range(rng.randint(1, 5))])


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", render([(5, 2), (10, 0), (3, 5)])))
    out.append(("sample-2", "sample", render([(1000000, 500000), (100, 50), (0, 0)])))
    rng = SplitMix64(0x5EED_0009)
    out.append(("hidden-min-1", "hidden", render([(0, 0)])))
    qs = []
    for n in [1, 2, 7, 1000, 999999, 1000000]:
        qs += [(n, 0), (n, n), (n, 1), (n, n - 1)]
    out.append(("hidden-edge-r-zero-or-n", "hidden", render(qs)))
    qs = [(0, 1), (5, 6), (999999, 1000000), (1, 1000000), (10, 11), (500000, 500001)] + [(rng.randint(0, 999), rng.randint(1000, 10**6)) for _ in range(30)]
    out.append(("hidden-trap-r-gt-n", "hidden", render(qs)))
    # fact[n] × inv[r] は 10^18 近くになり、32bit でも 2^53（double の整数精度）でも溢れる
    qs = [(10**6, r) for r in (2, 3, 12345, 333333, 499999, 500000, 777777)] + [(rng.randint(900000, 10**6), rng.randint(1, 900000)) for _ in range(40)]
    out.append(("hidden-trap-64bit", "hidden", render(qs)))
    qs = [(rng.randint(50000, 10**6), 0) for _ in range(5)]
    qs = [(n, rng.randint(1, n)) for n, _ in qs] + [(46341, 2), (65536, 3), (99991, 49999), (123456, 654), (765432, 1234)]
    out.append(("hidden-trap-number-precision", "hidden", render(qs)))
    for i in range(4):
        out.append((f"hidden-rand-{i + 1}", "hidden", render([(rng.randint(0, 60), rng.randint(0, 65)) for _ in range(rng.randint(5, 20))])))
    out.append(("hidden-mid-1", "hidden", render([(n, rng.randint(0, n + 10)) for n in (rng.randint(0, 10**6) for _ in range(1000))])))
    # 最大: r ≒ n/2 のクエリが 10^5 個。クエリごとに r 回掛ける素朴解は 4.5×10^10 回。1 割は r > n（出力 0）で .out を 1MB 未満に保つ
    qs = []
    for i in range(100000):
        n = rng.randint(900000, 10**6)
        qs.append((n, n + rng.randint(1, 1000)) if i % 10 == 9 else (n, n // 2 + rng.randint(-1000, 1000)))
    out.append(("hidden-max-half", "hidden", render(qs)))
    qs = []
    for i in range(50000):
        n = rng.randint(0, 10**6)
        qs.append((n, rng.randint(n + 1, 10**6 + 1) if n < 10**6 and i % 10 == 3 else rng.randint(0, n)))
    out.append(("hidden-max-random", "hidden", render([(n, min(r, 10**6)) for n, r in qs])))
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
