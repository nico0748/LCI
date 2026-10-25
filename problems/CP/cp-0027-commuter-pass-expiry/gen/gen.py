#!/usr/bin/env python3
"""cp-0027 定期券の有効期限 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0027 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


def is_leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def days_in(y: int, m: int) -> int:
    if m == 2:
        return 29 if is_leap(y) else 28
    return 30 if m in (4, 6, 9, 11) else 31


def expiry(y: int, m: int, d: int, k: int) -> tuple[int, int, int]:
    """想定解。月を 0 始まりの通し番号にして k を足し、年と月に戻す。同じ日があればその前日、無ければ月末"""
    idx = y * 12 + (m - 1) + k
    ty, tm = idx // 12, idx % 12 + 1
    last = days_in(ty, tm)
    if d > last:
        return ty, tm, last
    if d > 1:
        return ty, tm, d - 1
    # 1 日の前日は前の月の末日（1 月なら前の年の 12 月 31 日）
    py, pm = (ty, tm - 1) if tm > 1 else (ty - 1, 12)
    return py, pm, days_in(py, pm)


def solve(inp: str) -> str:
    lines = inp.split("\n")
    q = int(lines[0])
    out = []
    for i in range(1, q + 1):
        date, k = lines[i].split()
        y, m, d = map(int, date.split("/"))
        ey, em, ed = expiry(y, m, d, int(k))
        out.append(f"{ey:04d}/{em:02d}/{ed:02d}")
    return "\n".join(out) + "\n"


def fmt(rows: list[tuple[int, int, int, int]]) -> str:
    return f"{len(rows)}\n" + "".join(f"{y:04d}/{m:02d}/{d:02d} {k}\n" for y, m, d, k in rows)


def random_date(rng: SplitMix64, y0: int = 1900, y1: int = 2300) -> tuple[int, int, int]:
    y = rng.randint(y0, y1)
    m = rng.randint(1, 12)
    # 月末付近（28〜31 日）と 1 日を出やすくする
    r = rng.randint(0, 9)
    last = days_in(y, m)
    d = 1 if r == 0 else rng.randint(max(1, last - 3), last) if r <= 4 else rng.randint(1, last)
    return y, m, d


def random_small(rng: SplitMix64) -> str:
    rows = []
    for _ in range(rng.randint(1, 8)):
        y, m, d = random_date(rng, rng.choice([1900, 1996, 2096, 2296]), 2300)
        rows.append((y, m, d, rng.choice([1, 2, 11, 12, 13, 24, 48, rng.randint(1, 1200)])))
    rows = [(y, m, d, k) for y, m, d, k in rows if y * 12 + m - 1 + k <= 2400 * 12 + 11] or [(2000, 1, 31, 1)]
    return fmt(rows)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4\n2025/04/01 1\n2025/01/31 1\n2024/01/30 1\n2025/12/15 1\n"))
    out.append(("sample-2-century", "sample", "3\n2100/01/29 1\n2000/01/29 1\n2099/03/01 12\n"))
    out.append(("sample-3-month-end", "sample", "2\n2023/03/31 1\n2023/03/30 1\n"))
    rng = SplitMix64(0x5EED_0027)

    out.append(("hidden-min-1", "hidden", "1\n1900/01/01 1\n"))
    # 2/29 に開始（翌年は 2/29 が無い → 2/28 が末日、4 年後は 2/29 がある → その前日 2/28）
    rows = [(2024, 2, 29, k) for k in (1, 12, 13, 48, 96, 1200)] + [(1904, 2, 29, 1188), (2096, 2, 29, 48), (2000, 2, 29, 1200)]
    out.append(("hidden-trap-feb29-start", "hidden", fmt(rows)))
    # 100 で割り切れて 400 で割り切れない年（1900/2100/2200/2300 は平年、2000/2400 はうるう年）
    rows = []
    for y in (1900, 2000, 2100, 2200, 2300, 2400):
        rows += [(y - 1, 12, 29, 2), (y - 1, 12, 30, 2), (y, 1, 29, 1), (y, 1, 1, 2), (y - 1, 3, 1, 12)]
    rows = [r for r in rows if r[0] >= 1900 and r[0] <= 2300]
    rows += [(2300, 3, 1, 1200), (2200, 3, 1, 1200), (2000, 3, 1, 1200), (1900, 3, 1, 1200), (1950, 1, 31, 601), (2050, 1, 30, 601), (2300, 2, 28, 1200)]
    out.append(("hidden-trap-century-leap", "hidden", fmt(rows)))
    # 年の繰り上がり（12 月、k が 12 の倍数、k = 1200）
    rows = [(2025, 12, 31, 1), (2025, 12, 1, 1), (2025, 11, 30, 1), (2025, 12, 15, 12), (2025, 1, 1, 12), (2025, 12, 1, 13), (1900, 12, 31, 1200), (2300, 12, 31, 1200), (2300, 1, 1, 1200), (2199, 12, 31, 13), (2000, 6, 15, 1199)]
    out.append(("hidden-trap-year-carry", "hidden", fmt(rows)))
    # JS の Date(y, m, 31) は 3 月 3 日などに繰り上がる。前日を取るだけでは 1 日ずれる
    rows = [(2023, 1, 29, 1), (2023, 1, 30, 1), (2023, 1, 31, 1), (2024, 1, 30, 1), (2024, 1, 31, 1), (2023, 3, 31, 1), (2023, 5, 31, 1), (2023, 8, 31, 1), (2023, 10, 31, 1), (2023, 12, 31, 2), (2023, 10, 31, 4), (2100, 1, 31, 1)]
    out.append(("hidden-trap-js-date-rollover", "hidden", fmt(rows)))
    # 1 日開始: 前日は前の月の末日（前の月が 2 月ならうるう年の判定も要る）
    rows = [(2025, 1, 1, 1), (2025, 3, 1, 1), (2024, 3, 1, 12), (2023, 3, 1, 12), (2099, 3, 1, 1), (2025, 2, 1, 12), (2025, 1, 1, 11)]
    out.append(("hidden-trap-first-day", "hidden", fmt(rows)))
    # 月・日が 1 桁（0 埋めの出力）
    out.append(("hidden-trap-zero-pad", "hidden", fmt([(1999, 1, 2, 1), (2001, 8, 9, 1), (2010, 9, 10, 1), (2222, 2, 2, 7)])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt([(*random_date(rng), rng.randint(1, 1200)) for _ in range(rng.randint(20, 50))])))
    out.append(("hidden-mid-1", "hidden", fmt([(*random_date(rng), rng.randint(1, 1200)) for _ in range(2000)])))
    out.append(("hidden-max-random", "hidden", fmt([(*random_date(rng), rng.randint(1, 1200)) for _ in range(50000)])))
    rows = []
    for _ in range(50000):
        y = rng.randint(1900, 2300)
        m = rng.choice([1, 1, 3, 5, 8, 10, 12, 2])
        d = rng.randint(max(1, days_in(y, m) - 2), days_in(y, m)) if rng.randint(0, 3) else 1
        rows.append((y, m, d, rng.choice([1, 1, 12, 13, rng.randint(1, 1200)])))
    out.append(("hidden-max-month-end", "hidden", fmt(rows)))
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
