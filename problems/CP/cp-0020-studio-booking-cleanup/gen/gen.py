#!/usr/bin/env python3
"""cp-0020 片付け時間つきスタジオ予約 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0020 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


from bisect import bisect_left


def parse(inp: str) -> tuple[int, int, list[tuple[int, int]]]:
    tok = inp.split()
    n, c = int(tok[0]), int(tok[1])
    return n, c, [(int(tok[2 + 2 * i]), int(tok[3 + 2 * i])) for i in range(n)]


def solve(inp: str) -> str:
    """想定解。終了時刻の早い順に見て、「次に始められる最も早い時刻」以降に始まる予約を貪欲に受ける。O(N log N)"""
    n, c, bk = parse(inp)
    bk.sort(key=lambda x: x[1])
    free_at = 0  # 次の予約が始まってよい最も早い時刻（直前に受けた予約の終了 + C）。最大 10^9 + 2×10^9
    cnt = 0
    for s, e in bk:
        if s >= free_at:
            cnt += 1
            free_at = e + c
    return f"{cnt}\n"


def greedy_by(inp: str, key) -> str:
    """罠の確認用（誤答）: 終了時刻以外の順で貪欲に受ける。受けた予約は開始順に保ち、前後の 1 件とだけ両立を確かめる"""
    n, c, bk = parse(inp)
    bk.sort(key=key)
    taken: list[tuple[int, int]] = []
    for s, e in bk:
        i = bisect_left(taken, (s, e))
        if (i == 0 or s >= taken[i - 1][1] + c) and (i == len(taken) or taken[i][0] >= e + c):
            taken.insert(i, (s, e))
    return f"{len(taken)}\n"


CMAX = 2 * 10**9
TMAX = 10**9


def make(c: int, bk: list[tuple[int, int]]) -> str:
    assert 1 <= len(bk) <= 10**5 and 0 <= c <= CMAX and all(0 <= s < e <= TMAX for s, e in bk)
    return f"{len(bk)} {c}\n" + "".join(f"{s} {e}\n" for s, e in bk)


def random_bookings(rng: SplitMix64, n: int, tmax: int, dmax: int) -> list[tuple[int, int]]:
    out = []
    for _ in range(n):
        d = rng.randint(1, dmax)
        s = rng.randint(0, tmax - d)
        out.append((s, s + d))
    return out


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(1, 8)
    tmax = rng.choice([10, 20, 60])
    return make(rng.choice([0, 0, 1, 2, 5]), random_bookings(rng, n, tmax, rng.choice([2, 5, tmax])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def search(rng: SplitMix64, want, n: int, tmax: int, dmax: int, c: int, tries: int = 5000) -> str:
    for _ in range(tries):
        inp = make(c, random_bookings(rng, n, tmax, dmax))
        if want(inp):
            return inp
    raise AssertionError("見つからない")


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 10\n0 30\n20 50\n45 70\n90 120\n"))
    out.append(("sample-2-c0", "sample", "3 0\n10 20\n20 30\n15 25\n"))
    rng = SplitMix64(0x5EED_0020)
    out.append(("hidden-min-1", "hidden", make(5, [(0, 1)])))
    # 開始の早い順の貪欲は、最初に長い予約を取ってしまう
    bk = [(0, 1000)] + [(10 + 100 * i, 60 + 100 * i) for i in range(9)]
    rng.shuffle(bk)
    out.append(("hidden-trap-start-order", "hidden", make(30, bk)))
    # 長さの短い順の貪欲は、2 つの予約にまたがる短い予約を取ってしまう
    bk = [(0, 50), (55, 105), (45, 60), (110, 160), (165, 215), (155, 170), (220, 270)]
    out.append(("hidden-trap-shortest-first", "hidden", make(5, bk)))
    out.append(("hidden-trap-greedy-random", "hidden", search(rng, lambda s: solve(s) != greedy_by(s, lambda x: x[0]) and solve(s) != greedy_by(s, lambda x: x[1] - x[0]), 12, 300, 80, 7)))
    # 等号: 次の開始 = 前の終了 + C ちょうどは受けられる（> で比べると半分しか取れない）
    bk = []
    t = 0
    for i in range(12):
        bk.append((t, t + 40 + i))
        t = t + 40 + i + 15
    rng.shuffle(bk)
    out.append(("hidden-trap-equal-boundary", "hidden", make(15, bk)))
    # C = 0: 終わった時刻ちょうどに次を始めてよい
    out.append(("hidden-trap-c0-back-to-back", "hidden", make(0, [(0, 10), (10, 20), (20, 30), (5, 15), (15, 25), (30, 40), (40, 41)])))
    # 片付けを忘れて（C を足さずに）比べると多く取りすぎる
    out.append(("hidden-trap-forget-c", "hidden", make(100, [(0, 100), (150, 250), (300, 400), (420, 500), (600, 700)])))
    # 終了 + C が 2^31 - 1 を超える（int32 で足すと負になり、重なる予約まで受けてしまう）。正解は 1 件
    bk = [(300_000_000, 400_000_000), (500_000_000, 600_000_000), (700_000_000, 999_999_999), (650_000_000, 700_000_000), (999_999_999, 10**9)]
    out.append(("hidden-trap-int32-sum", "hidden", make(CMAX, bk)))
    bk = [(300_000_000, 400_000_000), (250_000_000, 260_000_000), (999_000_000, 10**9), (500_000_000, 999_000_000)]
    out.append(("hidden-trap-int32-sum-2", "hidden", make(1_900_000_000, bk)))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", make(rng.randint(0, 20), random_bookings(rng, rng.randint(5, 40), 500, 60))))
    out.append(("hidden-mid-1", "hidden", make(1000, random_bookings(rng, 3000, 10**7, 20000))))
    # 最大: N = 10^5 のランダム（時刻は 10^9 まで）
    out.append(("hidden-max-random", "hidden", make(3000, random_bookings(rng, 10**5, TMAX, 30000))))
    # 最大: 開始が最も早い予約が全体を覆い、残りは等号でつながる鎖（開始順の貪欲は 1 件、> で比べると 1 件おき）
    c = 7
    bk = []
    t = 1
    while len(bk) < 10**5 - 1:
        d = rng.randint(1, 3)
        bk.append((t, t + d))
        t = t + d + c
    bk.append((0, t))
    rng.shuffle(bk)
    out.append(("hidden-max-chain-under-long", "hidden", make(c, bk)))
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
