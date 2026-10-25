#!/usr/bin/env python3
"""cp-0023 配達ルートの最短巡回 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0023 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


import math
from itertools import permutations


def parse(inp: str):
    t = list(map(int, inp.split()))
    n, m = t[0], t[1]
    pts = [(t[2 + 2 * i], t[3 + 2 * i]) for i in range(n + 1)]
    k = 2 + 2 * (n + 1)
    cons = [(t[k + 2 * j], t[k + 1 + 2 * j]) for j in range(m)]
    return n, pts, cons


def solve(inp: str) -> str:
    """想定解（順列全探索）。地点 1..N の並べ方 N! 通りを試し、先行条件を満たすものの総距離の最小を取る"""
    n, pts, cons = parse(inp)
    d = [[math.dist(p, q) for q in pts] for p in pts]
    need = [0] * (n + 1)  # need[b] = b より先に訪れる地点の集合（ビット）
    for a, b in cons:
        need[b] |= 1 << a
    best = math.inf
    for perm in permutations(range(1, n + 1)):
        seen = 0
        ok = True
        for v in perm:
            if need[v] & ~seen:
                ok = False
                break
            seen |= 1 << v
        if not ok:
            continue
        total = d[0][perm[0]] + d[perm[-1]][0]
        for i in range(n - 1):
            total += d[perm[i]][perm[i + 1]]
        best = min(best, total)
    return f"{best:.10f}\n"


def fmt(pts: list[tuple[int, int]], cons: list[tuple[int, int]]) -> str:
    lines = [f"{len(pts) - 1} {len(cons)}"] + [f"{x} {y}" for x, y in pts] + [f"{a} {b}" for a, b in cons]
    return "\n".join(lines) + "\n"


def random_cons(rng: SplitMix64, n: int, m: int) -> list[tuple[int, int]]:
    """ランダムな訪問順を 1 つ決め、それと矛盾しない (a, b) を m 個（重複なし）選ぶ。必ず実行可能になる"""
    order = list(range(1, n + 1))
    rng.shuffle(order)
    pairs = [(order[i], order[j]) for i in range(n) for j in range(i + 1, n)]
    rng.shuffle(pairs)
    return pairs[:m]


def random_case(rng: SplitMix64, n: int, m: int, lim: int) -> str:
    pts = [(rng.randint(-lim, lim), rng.randint(-lim, lim)) for _ in range(n + 1)]
    return fmt(pts, random_cons(rng, n, m))


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 6)
    return random_case(rng, n, rng.randint(0, n * (n - 1) // 2), rng.choice([3, 10, 1000]))


def same(a: str, b: str) -> bool:
    x, y = float(a), float(b)
    return abs(x - y) <= 1e-6 or abs(x - y) <= 1e-6 * max(abs(x), abs(y))


def judge_ok(printed: str, ans: float) -> bool:
    """runner の float 比較（絶対誤差か相対誤差が 1e-6 以下）"""
    v = float(printed)
    return abs(v - ans) <= 1e-6 or abs(v - ans) <= 1e-6 * max(abs(v), abs(ans))


def precision_trap(rng: SplitMix64, n: int) -> str:
    """答えが 1000〜4000 で、小数 2 桁（%.2f）でも有効数字 6 桁（C の %g）でも誤差 1e-6 を超える入力を探す"""
    while True:
        inp = random_case(rng, n, rng.randint(0, 3), 400)
        ans = float(solve(inp))
        if 1000 <= ans <= 4000 and not judge_ok(f"{ans:.2f}", ans) and not judge_ok(f"{ans:g}", ans):
            return inp


def nearest_neighbor(inp: str) -> float:
    """貪欲（いちばん近い未訪問地点へ進む）。先行条件なしの入力で使い、最適と差が出るものを罠にする"""
    n, pts, _ = parse(inp)
    cur, left, total = 0, set(range(1, n + 1)), 0.0
    while left:
        nxt = min(left, key=lambda v: (math.dist(pts[cur], pts[v]), v))
        total += math.dist(pts[cur], pts[nxt])
        left.remove(nxt)
        cur = nxt
    return total + math.dist(pts[cur], pts[0])


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3 0\n0 0\n3 4\n3 -4\n6 0\n"))
    out.append(("sample-2-order", "sample", "3 2\n0 0\n2 0\n2 2\n0 2\n1 3\n3 2\n"))
    out.append(("sample-3-n1", "sample", "1 0\n5 5\n6 6\n"))
    rng = SplitMix64(0x5EED_0023)

    out.append(("hidden-min-n1-far", "hidden", fmt([(-1000, -1000), (1000, 1000)], [])))
    out.append(("hidden-edge-all-same", "hidden", fmt([(7, -3)] * 9, random_cons(rng, 8, 5))))
    out.append(("hidden-edge-duplicates", "hidden", fmt([(0, 0), (5, 5), (5, 5), (0, 0), (-5, 5), (5, 5)], [(3, 1)])))
    out.append(("hidden-trap-precision-1", "hidden", precision_trap(rng, 6)))
    out.append(("hidden-trap-precision-2", "hidden", precision_trap(rng, 8)))
    # 全順序（28 個の条件）で訪問順が 1 通りしかない
    out.append(("hidden-trap-total-order", "hidden", random_case(rng, 8, 28, 1000)))
    # 円周上の 8 点。条件 1→5→2→6→3 で円を横切る順が強制され、円周どおりに回る巡回は使えない
    pts = [(0, 0)] + [(round(500 * math.cos(2 * math.pi * k / 8)), round(500 * math.sin(2 * math.pi * k / 8))) for k in range(8)]
    out.append(("hidden-trap-zigzag-orders", "hidden", fmt(pts, [(1, 5), (5, 2), (2, 6), (6, 3)])))
    # 先行条件なしで、近い所から回る貪欲が最適にならない
    while True:
        inp = random_case(rng, 7, 0, 1000)
        if nearest_neighbor(inp) > float(solve(inp)) + 1:
            break
    out.append(("hidden-trap-greedy-nearest", "hidden", inp))
    for i in range(3):
        n = rng.randint(4, 7)
        out.append((f"hidden-rand-{i + 1}", "hidden", random_case(rng, n, rng.randint(0, n), 1000)))
    out.append(("hidden-max-free", "hidden", random_case(rng, 8, 0, 1000)))
    out.append(("hidden-max-some-orders", "hidden", random_case(rng, 8, 4, 1000)))
    pts = [(rng.randint(-1000, 1000), rng.randint(-1000, 1000))]
    for c in [(-900, -900), (900, 900), (900, -900)]:
        pts += [(c[0] + rng.randint(-30, 30), c[1] + rng.randint(-30, 30)) for _ in range(3)]
    out.append(("hidden-max-clusters", "hidden", fmt(pts[:9], random_cons(rng, 8, 2))))
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
