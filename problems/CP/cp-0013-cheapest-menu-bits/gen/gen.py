#!/usr/bin/env python3
"""cp-0013 栄養を満たす最安の献立 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0013 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


def parse(inp: str) -> tuple[int, int, list[int], list[int]]:
    it = iter(inp.split())
    n, m = int(next(it)), int(next(it))
    price, mask = [], []
    for _ in range(n):
        p, k = int(next(it)), int(next(it))
        b = 0
        for _ in range(k):
            b |= 1 << (int(next(it)) - 1)
        price.append(p)
        mask.append(b)
    return n, m, price, mask


def solve(inp: str) -> str:
    """想定解。料理ごとの栄養をビットマスクにし、2^N 通りの選び方の OR と合計を「1 品少ない集合 + 最下位の 1 品」から O(1) で作る"""
    n, m, price, mask = parse(inp)
    full = (1 << m) - 1
    cover = [0] * (1 << n)
    cost = [0] * (1 << n)
    best, ways = -1, 0
    for s in range(1, 1 << n):
        low = s & -s
        i = low.bit_length() - 1
        cover[s] = cover[s ^ low] | mask[i]
        cost[s] = cost[s ^ low] + price[i]
        if cover[s] == full:
            if best == -1 or cost[s] < best:
                best, ways = cost[s], 1
            elif cost[s] == best:
                ways += 1
    return "-1\n" if best == -1 else f"{best} {ways}\n"


def make(m: int, dishes: list[tuple[int, list[int]]]) -> str:
    n = len(dishes)
    assert 1 <= n <= 15 and 1 <= m <= 10
    lines = [f"{n} {m}"]
    for p, nut in dishes:
        assert 0 <= p <= 10**9 and len(set(nut)) == len(nut) and all(1 <= a <= m for a in nut)
        lines.append(" ".join(map(str, [p, len(nut), *nut])))
    return "\n".join(lines) + "\n"


def random_dishes(rng: SplitMix64, n: int, m: int, pmax: int, kmax: int, pmin: int = 0) -> list[tuple[int, list[int]]]:
    out = []
    for _ in range(n):
        nut = list(range(1, m + 1))
        rng.shuffle(nut)
        k = rng.randint(0, min(kmax, m))
        out.append((rng.randint(pmin, pmax), sorted(nut[:k])))
    return out


def random_small(rng: SplitMix64) -> str:
    n, m = rng.randint(1, 7), rng.randint(1, 4)
    return make(m, random_dishes(rng, n, m, rng.choice([0, 3, 10, 1000]), rng.randint(1, m)))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 3\n500 2 1 2\n300 1 3\n700 3 1 2 3\n200 1 1\n"))
    out.append(("sample-2-ties", "sample", "3 2\n400 1 1\n400 1 2\n800 2 1 2\n"))
    out.append(("sample-3-impossible", "sample", "2 3\n100 2 1 2\n100 1 2\n"))
    rng = SplitMix64(0x5EED_0013)
    out.append(("hidden-min-1", "hidden", make(1, [(7, [1])])))
    out.append(("hidden-min-impossible", "hidden", make(2, [(5, [2])])))
    # 栄養 10 を含む料理が 1 つも無い → -1（-1 を 0 や巨大値で出してしまう誤りを見る）
    out.append(("hidden-trap-impossible-max", "hidden", make(10, [(p, [a for a in nut if a != 10]) for p, nut in random_dishes(rng, 15, 10, 10**9, 6)])))
    # 同額の組がたくさんある（最小が更新されたら数を 1 に戻す、等しいときは数を足す）
    # 先に 400 円の 2 通りが見つかり、あとで 300 円が 4 通り見つかる（最小が下がったら数を 1 に戻す）
    dishes = [(400, [1, 2, 3, 4]), (400, [1, 2, 3, 4]), (200, [1, 2]), (100, [3, 4]), (150, [1]), (150, [2, 3, 4]), (300, [1, 2, 3, 4]), (120, [4]), (200, [1, 2, 3])]
    out.append(("hidden-trap-ties", "hidden", make(4, dishes)))
    # 値段 0 の料理: 入れても入れなくても合計は同じなので、選び方の数が倍になる（「最安なら余計な料理は入れない」と決めつけると数がずれる）
    dishes = [(0, [1]), (0, []), (5, [2, 3]), (0, [3]), (3, [2]), (2, [3]), (0, [2, 1])]
    out.append(("hidden-trap-zero-price", "hidden", make(3, dishes)))
    # 栄養を 1 つも含まない料理（K_i = 0）が混ざる
    dishes = [(10, []), (1, [1, 2]), (0, []), (4, [3]), (9, []), (2, [2, 3]), (3, [1])]
    out.append(("hidden-trap-empty-dish", "hidden", make(3, dishes)))
    # 合計が 2^31 を超える（10 品すべてが必要で、どれも 10^9 円近い）
    dishes = [(10**9 - i, [i + 1]) for i in range(10)] + [(10**9, [1, 2]), (10**9, [3, 4, 5]), (10**9, [6]), (999_999_999, [7, 8]), (10**9, [9, 10])]
    out.append(("hidden-trap-64bit", "hidden", make(10, dishes)))
    out.append(("hidden-edge-all-free-full", "hidden", make(10, [(0, list(range(1, 11))) for _ in range(15)])))
    for i in range(3):
        n, m = rng.randint(5, 10), rng.randint(3, 6)
        out.append((f"hidden-rand-{i + 1}", "hidden", make(m, random_dishes(rng, n, m, 20, 3))))
    out.append(("hidden-max-random", "hidden", make(10, random_dishes(rng, 15, 10, 10**9, 4))))
    out.append(("hidden-max-many-ties", "hidden", make(10, random_dishes(rng, 15, 10, 3, 5, pmin=1))))
    out.append(("hidden-max-one-each", "hidden", make(10, [(rng.randint(1, 10**9), [i % 10 + 1]) for i in range(15)])))
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
