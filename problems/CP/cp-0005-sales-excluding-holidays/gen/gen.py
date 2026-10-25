#!/usr/bin/env python3
"""cp-0005 休業日を除いた期間売上 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0005 --naive` で hidden-max-* のどれかが TLE することを確かめる
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

def solve(inp: str) -> str:
    """想定解。売上（休業日は 0 として）と営業日数の累積和を 2 本作り、各期間を O(1) で答える"""
    tok = inp.split()
    n, q = int(tok[0]), int(tok[1])
    ps = [0] * (n + 1)  # ps[i] = 1..i 日目の営業日の売上合計
    pc = [0] * (n + 1)  # pc[i] = 1..i 日目の営業日数
    for i in range(n):
        a = int(tok[2 + i])
        ps[i + 1] = ps[i] + (a if a >= 0 else 0)
        pc[i + 1] = pc[i] + (1 if a >= 0 else 0)
    res = []
    p = 2 + n
    for _ in range(q):
        l, r = int(tok[p]), int(tok[p + 1])
        p += 2
        res.append(f"{ps[r] - ps[l - 1]} {pc[r] - pc[l - 1]}")
    return "\n".join(res) + "\n"


def render(a: list[int], qs: list[tuple[int, int]]) -> str:
    return f"{len(a)} {len(qs)}\n" + " ".join(map(str, a)) + "\n" + "".join(f"{l} {r}\n" for l, r in qs)


def rand_days(rng: SplitMix64, n: int, hi: int, holiday_pct: int, zero_pct: int = 5) -> list[int]:
    out = []
    for _ in range(n):
        t = rng.randint(1, 100)
        out.append(-1 if t <= holiday_pct else 0 if t <= holiday_pct + zero_pct else rng.randint(1, hi))
    return out


def rand_queries(rng: SplitMix64, n: int, q: int, min_len: int = 1) -> list[tuple[int, int]]:
    qs = []
    for _ in range(q):
        l = rng.randint(1, n - min_len + 1)
        r = rng.randint(l + min_len - 1, n)
        qs.append((l, r))
    return qs


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 10)
    a = [rng.choice([-1, -1, 0, rng.randint(0, 20), 10**9]) for _ in range(n)]
    return render(a, rand_queries(rng, n, rng.randint(1, 6)))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", render([120, -1, 300, 0, -1, 450, 80], [(1, 7), (2, 5), (6, 7)])))
    out.append(("sample-2-all-closed", "sample", render([-1, -1, 500, -1], [(1, 2), (1, 4)])))
    rng = SplitMix64(0x5EED_0005)
    out.append(("hidden-min-closed", "hidden", render([-1], [(1, 1)])))
    out.append(("hidden-min-zero-sales", "hidden", render([0], [(1, 1)])))
    n = 2000
    out.append(("hidden-trap-overflow", "hidden", render([10**9] * n, [(1, n), (2, n), (1, 1000), (7, 1999)] + rand_queries(rng, n, 50, 500))))
    a = [-1] * 1000
    for i in range(0, 1000, 97):
        a[i] = rng.randint(1, 10**6)
    qs = [(i + 2, min(i + 96, 1000)) for i in range(0, 1000, 97)] + [(1, 1000), (98, 98), (99, 193)]
    out.append(("hidden-trap-all-closed", "hidden", render(a, qs)))
    # 売上を 2 の累乗にしておき、両端の 1 日のずれが答えに必ず出るようにする
    a = [1 << i for i in range(40)]
    qs = [(i, i) for i in range(1, 41)] + [(1, 40), (1, 1), (40, 40), (5, 6), (39, 40), (1, 2)]
    out.append(("hidden-trap-inclusive", "hidden", render(a, qs)))
    a = rand_days(rng, 500, 1000, 20, 40)
    out.append(("hidden-trap-zero-sales", "hidden", render(a, rand_queries(rng, 500, 200))))
    a = rand_days(rng, 500, 30, 60, 0)
    out.append(("hidden-trap-minus-one", "hidden", render(a, rand_queries(rng, 500, 200))))
    for i in range(4):
        n = rng.randint(10, 60)
        out.append((f"hidden-rand-{i + 1}", "hidden", render(rand_days(rng, n, 10**6, 25), rand_queries(rng, n, rng.randint(5, 30)))))
    out.append(("hidden-mid-1", "hidden", render(rand_days(rng, 5000, 10**9, 20), rand_queries(rng, 5000, 5000))))
    # 最大: ほぼ全期間のクエリを 5×10^4 個（1 件ずつ足す素朴解は 10^10 回）。出力が 1MB を超えないよう売上は 10^4 以下
    n = 200000
    qs = [(rng.randint(1, 100), rng.randint(n - 100, n)) for _ in range(50000)]
    out.append(("hidden-max-full-range", "hidden", render(rand_days(rng, n, 10**4, 25), qs)))
    out.append(("hidden-max-big-values", "hidden", render(rand_days(rng, 100000, 10**9, 10), rand_queries(rng, 100000, 10000))))
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
