#!/usr/bin/env python3
"""cp-0019 抽選番号の素数クエリ のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0019 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


from itertools import accumulate

LIMIT = 10**6


def sieve(n: int) -> bytearray:
    """is_p[x] = 1 なら x は素数（0 と 1 は素数でない）"""
    is_p = bytearray([1]) * (n + 1)
    is_p[0] = is_p[1] = 0
    for i in range(2, int(n**0.5) + 1):
        if is_p[i]:
            is_p[i * i :: i] = bytes(len(range(i * i, n + 1, i)))
    return is_p


_PREFIX: list[int] = []


def solve(inp: str) -> str:
    """想定解。10^6 までの篩と累積和を 1 回だけ作り、各クエリは pre[R] - pre[L-1] の O(1)"""
    if not _PREFIX:
        _PREFIX.extend(accumulate(sieve(LIMIT), initial=0))  # _PREFIX[x] = 1..x-1 の素数の個数（initial の分ずれる）
    pre = _PREFIX
    tok = inp.split()
    q = int(tok[0])
    out = []
    for i in range(q):
        lo, hi = int(tok[1 + 2 * i]), int(tok[2 + 2 * i])
        out.append(pre[hi + 1] - pre[lo])
    return "\n".join(map(str, out)) + "\n"


def make(qs: list[tuple[int, int]]) -> str:
    assert 1 <= len(qs) <= 10**5 and all(1 <= a <= b <= LIMIT for a, b in qs)
    return f"{len(qs)}\n" + "".join(f"{a} {b}\n" for a, b in qs)


def random_small(rng: SplitMix64) -> str:
    hi = rng.choice([10, 30, 200])
    qs = []
    for _ in range(rng.randint(1, 6)):
        a = rng.randint(1, hi)
        qs.append((a, rng.randint(a, min(hi, a + rng.choice([0, 3, 50])))))
    return make(qs)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3\n1 10\n11 11\n14 16\n"))
    out.append(("sample-2", "sample", "2\n20 30\n1 100\n"))
    rng = SplitMix64(0x5EED_0019)
    out.append(("hidden-min-1", "hidden", make([(1, 1)])))
    # 1 は素数でない（篩の初期化で is_p[1] を残すと 1 つ多くなる）
    out.append(("hidden-trap-one-not-prime", "hidden", make([(1, 1), (1, 2), (1, 3), (1, 4), (1, 1000000)])))
    # L = R（素数のときと合成数のとき）
    out.append(("hidden-trap-l-equals-r", "hidden", make([(2, 2), (4, 4), (999983, 999983), (1000000, 1000000), (7, 7), (9, 9), (65537, 65537), (999999, 999999)])))
    # 両端を含む: L と R がともに素数（pre[R] - pre[L] だと L の分が抜ける、R - 1 までだと R が抜ける）
    out.append(("hidden-trap-inclusive-ends", "hidden", make([(2, 3), (3, 5), (5, 7), (7, 11), (999979, 999983), (13, 13), (101, 103), (2, 1000000)])))
    out.append(("hidden-edge-no-prime", "hidden", make([(24, 28), (114, 126), (1000000, 1000000), (370262, 370360), (1, 1), (32, 36)])))
    for i in range(3):
        qs = []
        for _ in range(rng.randint(5, 30)):
            a = rng.randint(1, 5000)
            qs.append((a, rng.randint(a, 5000)))
        out.append((f"hidden-rand-{i + 1}", "hidden", make(qs)))
    qs = []
    for _ in range(2000):
        a = rng.randint(1, LIMIT)
        qs.append((a, rng.randint(a, LIMIT)))
    out.append(("hidden-mid-1", "hidden", make(qs)))
    # 最大: Q = 10^5、どのクエリもほぼ全範囲（クエリごとに数え直すと 10^5 × 10^6 回）
    qs = [(rng.randint(1, 100), rng.randint(999_000, LIMIT)) for _ in range(10**5)]
    out.append(("hidden-max-wide", "hidden", make(qs)))
    qs = []
    for _ in range(10**5):
        a, b = rng.randint(1, LIMIT), rng.randint(1, LIMIT)
        qs.append((min(a, b), max(a, b)))
    out.append(("hidden-max-random", "hidden", make(qs)))
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
