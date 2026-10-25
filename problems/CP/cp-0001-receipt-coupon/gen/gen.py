#!/usr/bin/env python3
"""cp-0001 レシートの合計とクーポン のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0001 --naive` で hidden-max-* のどれかが TLE することを確かめる
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

LETTERS = "abcdefghijklmnopqrstuvwxyz"


def solve(inp: str) -> str:
    """想定解。小計 → クーポン（S ≥ X なら Y 円引き、0 で止める）→ 税（整数で切り捨て）"""
    tok = inp.split()
    n, x, y = int(tok[0]), int(tok[1]), int(tok[2])
    s = 0
    for i in range(n):
        s += int(tok[4 + 3 * i]) * int(tok[5 + 3 * i])
    t = max(s - y, 0) if s >= x else s
    return f"{t + t * 10 // 100}\n"


def render(x: int, y: int, items: list[tuple[str, int, int]]) -> str:
    lines = [f"{len(items)} {x} {y}"] + [f"{name} {p} {q}" for name, p, q in items]
    return "\n".join(lines) + "\n"


def rand_name(rng: SplitMix64) -> str:
    return "".join(rng.choice(LETTERS) for _ in range(rng.randint(1, 10)))


def rand_items(rng: SplitMix64, n: int, pmax: int, qmax: int) -> list[tuple[str, int, int]]:
    return [(rand_name(rng), rng.randint(1, pmax), rng.randint(1, qmax)) for _ in range(n)]


def subtotal(items: list[tuple[str, int, int]]) -> int:
    return sum(p * q for _, p, q in items)


def random_small(rng: SplitMix64) -> str:
    items = rand_items(rng, rng.randint(1, 5), 60, 3)
    s = subtotal(items)
    # X は S の前後（境界）が出やすいように選ぶ
    x = rng.choice([s - 1, s, s + 1, rng.randint(1, 2 * s + 5)])
    x = max(x, 1)
    y = rng.choice([rng.randint(1, s + 20), s, s + 1, rng.randint(1, 10)])
    return render(x, max(y, 1), items)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def items_with_total(rng: SplitMix64, n: int, total: int) -> list[tuple[str, int, int]]:
    """小計がちょうど total になる n 品目。最後の 1 品で調整し、作れなければ引き直す（決定的）"""
    while True:
        items = rand_items(rng, n - 1, max(1, min(5000, total // (n * 3))), 3)
        rest = total - subtotal(items)
        for q in range(1, 21):
            if rest >= q and rest % q == 0 and rest // q <= 5000:
                items.append((rand_name(rng), rest // q, q))
                return items


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", render(1000, 100, [("apple", 120, 3), ("milk", 198, 2), ("bread", 250, 1)])))
    out.append(("sample-2-no-coupon", "sample", render(3000, 500, [("notebook", 280, 5), ("pen", 110, 4)])))
    rng = SplitMix64(0x5EED_0001)
    out.append(("hidden-min-1", "hidden", render(1, 1, [("a", 1, 1)])))
    out.append(("hidden-edge-just-below", "hidden", render(3000, 500, items_with_total(rng, 4, 2999))))
    out.append(("hidden-trap-boundary-equal", "hidden", render(5000, 700, items_with_total(rng, 6, 5000))))
    out.append(("hidden-trap-boundary-equal-2", "hidden", render(12345, 345, items_with_total(rng, 3, 12345))))
    out.append(("hidden-trap-negative", "hidden", render(500, 2000, items_with_total(rng, 3, 800))))
    out.append(("hidden-trap-negative-exact-zero", "hidden", render(100, 640, items_with_total(rng, 2, 640))))
    # 割引後 T = 1999（T × 1.1 = 2198.9 を四捨五入すると 2199 で WA）
    out.append(("hidden-trap-tax-round", "hidden", render(1000, 200, items_with_total(rng, 5, 2199))))
    # 割引後 T = 1250（T × 1.1 を小数のまま出すと 1375.0000000000002 などになる）
    out.append(("hidden-trap-tax-integer", "hidden", render(9999, 1, items_with_total(rng, 4, 1250))))
    for i in range(4):
        # 通常の買い物（X は小計の前後 2 割、Y は小計の 1/4 以下）
        items = rand_items(rng, rng.randint(2, 10), 3000, 5)
        s = subtotal(items)
        out.append((f"hidden-rand-{i + 1}", "hidden", render(rng.randint(s * 8 // 10, s * 12 // 10), rng.randint(1, s // 4), items)))
    out.append(("hidden-max-1", "hidden", render(10**7, 1, [(rand_name(rng), 5000, 20) for _ in range(100)])))
    items = rand_items(rng, 100, 5000, 20)
    out.append(("hidden-max-2", "hidden", render(subtotal(items) - 12345, 98765, items)))
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
