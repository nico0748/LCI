#!/usr/bin/env python3
"""cp-0017 平均点の切り捨て表示 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0017 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解。整数だけで計算する: 表示は sum×10 // N を「整数部.小数第 1 位」に、比較は score×N ≥ sum"""
    tok = inp.split()
    n = int(tok[0])
    names = tok[1 : 1 + 2 * n : 2]
    scores = list(map(int, tok[2 : 2 + 2 * n : 2]))
    total = sum(scores)
    v = total * 10 // n
    out = [f"{v // 10}.{v % 10}"]
    out += [nm for nm, sc in zip(names, scores) if sc * n >= total]
    return "\n".join(out) + "\n"


LOWER = "abcdefghijklmnopqrstuvwxyz"


def make(people: list[tuple[str, int]]) -> str:
    assert 1 <= len(people) <= 100 and len({p[0] for p in people}) == len(people)
    assert all(1 <= len(nm) <= 10 and set(nm) <= set(LOWER) and 0 <= sc <= 100 for nm, sc in people)
    return f"{len(people)}\n" + "".join(f"{nm} {sc}\n" for nm, sc in people)


def names(rng: SplitMix64, n: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    while len(out) < n:
        s = "".join(rng.choice(LOWER) for _ in range(rng.randint(1, 10)))
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def with_scores(rng: SplitMix64, scores: list[int]) -> str:
    return make(list(zip(names(rng, len(scores)), scores)))


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 7)
    lo = rng.randint(0, 100)
    hi = rng.randint(lo, min(100, lo + rng.choice([0, 2, 10, 100])))
    return with_scores(rng, [rng.randint(lo, hi) for _ in range(n)])


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "5\nsato 60\nsuzuki 75\ntanaka 80\nito 72\nkato 65\n"))
    out.append(("sample-2-integer", "sample", "4\nmori 50\nabe 70\nueda 90\nnoda 70\n"))
    rng = SplitMix64(0x5EED_0017)
    out.append(("hidden-min-1", "hidden", make([("solo", 0)])))
    out.append(("hidden-edge-all-100", "hidden", with_scores(rng, [100] * 7)))
    out.append(("hidden-edge-all-zero", "hidden", with_scores(rng, [0] * 5)))
    # 66.66… → 66.6（%.1f や round は 66.7 にしてしまう）
    out.append(("hidden-trap-round-up", "hidden", with_scores(rng, [60, 70, 70])))
    # 99.98 → 99.9（四捨五入だと 100.0 になり、桁も変わる）
    out.append(("hidden-trap-round-up-to-100", "hidden", with_scores(rng, [100] * 98 + [99, 99])))
    # 平均 70.05 → 表示は 70.0。70 点の人は「平均以上」ではない（表示した 70.0 と比べると入れてしまう）
    out.append(("hidden-trap-compare-displayed", "hidden", with_scores(rng, [70] * 10 + [71] + [70] * 9)))
    # 平均 70.5。整数の割り算（sum / N = 70）と比べると 70 点の人を入れてしまう
    out.append(("hidden-trap-compare-int-div", "hidden", with_scores(rng, [70, 71, 70, 71, 69, 72])))
    # 平均ちょうどの人が多い（「より大きい」と読むと落ちる）。平均は整数なので .0 を付ける
    out.append(("hidden-trap-equal-and-format", "hidden", with_scores(rng, [80, 80, 60, 100, 80, 80])))
    for i in range(3):
        n = rng.randint(5, 30)
        out.append((f"hidden-rand-{i + 1}", "hidden", with_scores(rng, [rng.randint(0, 100) for _ in range(n)])))
    out.append(("hidden-max-random", "hidden", with_scores(rng, [rng.randint(0, 100) for _ in range(100)])))
    # 最大: 平均が整数 + 0.01〜0.09 になるよう 100 人をそろえる（表示値・四捨五入のどちらの誤りも出る）
    sc = [73] * 100
    sc[0] = 77  # 合計 7304 → 平均 73.04 → 表示 73.0、73 点の 99 人は対象外
    out.append(("hidden-max-near-integer", "hidden", with_scores(rng, sc)))
    sc = [rng.randint(40, 60) for _ in range(100)]
    out.append(("hidden-max-narrow", "hidden", with_scores(rng, sc)))
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
