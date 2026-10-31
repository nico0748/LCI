#!/usr/bin/env python3
"""cp-0034 すごろくのワープと跳ね返り のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0034 --naive` で hidden-max-* のどれかが TLE することを確かめる
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

def parse(inp: str):
    tok = list(map(int, inp.split()))
    n, k = tok[0], tok[1]
    dice = tok[2 : 2 + k]
    m = tok[2 + k]
    warp = {}
    for j in range(m):
        s, t = tok[3 + k + 2 * j], tok[4 + k + 2 * j]
        warp[s] = t
    return n, dice, warp


def solve(inp: str) -> str:
    """想定解: 1 投ごとに 進む → 越えたら戻る → ちょうど N ならゴール → ワープを 1 回だけ"""
    n, dice, warp = parse(inp)
    pos = 0
    for t, d in enumerate(dice, 1):
        pos += d
        if pos > n:
            pos = n - (pos - n)
        if pos == n:
            return f"GOAL {t}\n"
        pos = warp.get(pos, pos)  # 出口のワープは続けて使わない
    return f"{pos}\n"


def render(n: int, dice: list[int], warps: list[tuple[int, int]]) -> str:
    lines = [f"{n} {len(dice)}", " ".join(map(str, dice)), str(len(warps))]
    lines += [f"{s} {t}" for s, t in warps]
    return "\n".join(lines) + "\n"


def random_warps(rng: SplitMix64, n: int, m: int) -> list[tuple[int, int]]:
    srcs = list(range(1, n))
    rng.shuffle(srcs)
    out = []
    for s in srcs[:m]:
        t = rng.randint(0, n - 1)
        while t == s:
            t = rng.randint(0, n - 1)
        out.append((s, t))
    return out


def random_case(rng: SplitMix64, nmax: int, kmax: int) -> str:
    n = rng.randint(6, nmax)
    k = rng.randint(1, kmax)
    dice = [rng.randint(1, 6) for _ in range(k)]
    m = rng.randint(0, min(n - 1, 12))
    return render(n, dice, random_warps(rng, n, m))


def random_small(rng: SplitMix64) -> str:
    return random_case(rng, 14, 15)


def no_goal_dice(rng: SplitMix64, n: int, k: int, warp: dict[int, int]) -> list[int]:
    """ゴールに一度も止まらない出目の列（最大ケース用。全 K 投を使わせる）"""
    pos, dice = 0, []
    for _ in range(k):
        while True:
            d = rng.randint(1, 6)
            q = pos + d
            if q > n:
                q = n - (q - n)
            if q != n:
                break
        dice.append(d)
        pos = warp.get(q, q)
    return dice


def same(a: str, b: str) -> bool:
    """stress の比較: 空白区切りのトークン一致（compare.mode = token）"""
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "10 4\n3 5 4 6\n2\n3 8\n9 2\n"))
    out.append(("sample-2-goal", "sample", "6 4\n4 2 5 1\n0\n"))
    rng = SplitMix64(0x5EED_0034)
    out.append(("hidden-min-1", "hidden", render(6, [6], [])))
    out.append(("hidden-edge-no-warp-no-goal", "hidden", render(20, [1, 2, 3, 4, 5, 3], [])))
    # 戻った先がワープの入口: 戻ったあとにワープを確認しないと WA
    out.append(("hidden-trap-bounce-warp", "hidden", render(12, [6, 4, 6, 5, 6, 4, 6, 1], [(10, 3), (11, 2), (8, 6)])))
    # ちょうど止まったときだけゴール。「N 以上ならゴール」と読むと WA
    out.append(("hidden-trap-exact-goal", "hidden", render(8, [5, 6, 1, 6, 4, 2, 3], [(2, 1)])))
    # ゴールした後の出目は使わない（続けて動かすと位置が変わる）
    out.append(("hidden-trap-after-goal", "hidden", render(9, [3, 6, 6, 6, 6, 1, 2, 3], [(3, 0)])))
    # ワープの出口が別のワープの入口でも続けて飛ばない。出口が 0（スタート）のワープも
    out.append(("hidden-trap-warp-chain", "hidden", render(15, [2, 3, 4, 1, 6, 5, 2, 2], [(2, 5), (5, 9), (9, 0), (7, 2), (4, 12)])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_case(rng, 30, 40)))
    # 最大: N=100、K=100、ワープ多数。1 件はゴールせずに全 100 投を使う
    n, k = 100, 100
    warps = random_warps(rng, n, 40)
    out.append(("hidden-max-no-goal", "hidden", render(n, no_goal_dice(rng, n, k, dict(warps)), warps)))
    warps = random_warps(rng, n, 99)
    dice = [rng.randint(1, 6) for _ in range(k)]
    out.append(("hidden-max-many-warps", "hidden", render(n, dice, warps)))
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
