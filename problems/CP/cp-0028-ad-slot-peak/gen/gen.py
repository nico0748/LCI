#!/usr/bin/env python3
"""cp-0028 広告枠の最大同時掲載額 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0028 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解（イベントソート）。(時刻, 増減) を並べ、同じ時刻の増減をすべて反映してから合計を見る。
    時刻が 10^9 まであるので配列のいもす法は使えない（座標圧縮と同じ考え方で、変化する時刻だけを見る）"""
    t = list(map(int, inp.split()))
    n = t[0]
    ev: dict[int, int] = {}
    for i in range(n):
        s, e, c = t[1 + 3 * i], t[2 + 3 * i], t[3 + 3 * i]
        ev[s] = ev.get(s, 0) + c
        ev[e] = ev.get(e, 0) - c
    cur, best, at = 0, -1, -1
    for x in sorted(ev):
        cur += ev[x]
        if cur > best:
            best, at = cur, x
    return f"{best} {at}\n"


def fmt(ads: list[tuple[int, int, int]]) -> str:
    return f"{len(ads)}\n" + "".join(f"{s} {e} {c}\n" for s, e, c in ads)


def random_ads(rng: SplitMix64, n: int, tmax: int, cmax: int) -> list[tuple[int, int, int]]:
    ads = []
    for _ in range(n):
        a, b = rng.randint(0, tmax), rng.randint(0, tmax)
        while a == b:
            b = rng.randint(0, tmax)
        ads.append((min(a, b), max(a, b), rng.randint(1, cmax)))
    return ads


def random_small(rng: SplitMix64) -> str:
    """時刻を 0〜30 に詰めて、端点の一致（終了と開始が同じ時刻）を起きやすくする"""
    return fmt(random_ads(rng, rng.randint(1, 7), rng.choice([3, 10, 30]), rng.choice([1, 3, 10**9])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3\n1 5 100\n3 8 200\n5 9 50\n"))
    out.append(("sample-2-big", "sample", "2\n0 1000000000 1000000000\n999999999 1000000000 1000000000\n"))
    out.append(("sample-3-earliest", "sample", "3\n30 40 3\n35 50 2\n10 20 5\n"))
    rng = SplitMix64(0x5EED_0028)

    out.append(("hidden-min-1", "hidden", "1\n7 8 1\n"))
    # 終了と開始が同じ時刻の鎖。開始を先に足すと、境界で 2 本分の高い山が見える
    ads = [(1000 * i, 1000 * (i + 1), 10**9 - i) for i in range(2000)]
    rng.shuffle(ads)
    out.append(("hidden-trap-end-before-start", "hidden", fmt(ads)))
    # 和が 2^31 を大きく超える（10^4 本 × 10^9）。重なりは途中の 1 点だけ
    ads = [(rng.randint(0, 5 * 10**8), rng.randint(5 * 10**8 + 1, 10**9), 10**9) for _ in range(5000)]
    ads += [(rng.randint(0, 10**8), rng.randint(10**8 + 1, 2 * 10**8), 10**9) for _ in range(5000)]
    out.append(("hidden-trap-int64", "hidden", fmt(ads)))
    # 時刻が 10^9 付近まで散らばる（配列のいもす法は 10^9 要素で MLE / TLE）
    out.append(("hidden-trap-huge-times", "hidden", fmt(random_ads(rng, 3000, 10**9, 10**6))))
    # 同じ最大値の山が 3 つ。入力の順と時刻の順が逆（最初の時刻を答える）
    ads = []
    for base in (900_000_000, 500_000_000, 100_000_000):
        ads += [(base, base + 100, 40), (base + 50, base + 80, 60)]
    ads += [(50, 60, 99), (99_999_950, 100_000_000, 99)]  # 2 本目は山の開始と同じ時刻に終わる
    out.append(("hidden-trap-earliest-peak", "hidden", fmt(ads)))
    # 開始時刻がすべて同じ・終了がばらばら（最大はその開始時刻）
    out.append(("hidden-trap-same-start", "hidden", fmt([(123456789, rng.randint(123456790, 10**9), rng.randint(1, 10**9)) for _ in range(1000)])))
    out.append(("hidden-edge-zero-and-max", "hidden", fmt([(0, 1, 5), (999_999_999, 10**9, 5), (0, 10**9, 1)])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(random_ads(rng, rng.randint(5, 40), rng.choice([50, 10**6, 10**9]), rng.choice([5, 10**9])))))
    out.append(("hidden-mid-1", "hidden", fmt(random_ads(rng, 5000, 10**9, 10**9))))
    # 最大: 10^5 本がランダム（候補時刻ごとに全広告を数えると 10^10 回）
    out.append(("hidden-max-random", "hidden", fmt(random_ads(rng, 100000, 10**9, 99))))
    # 最大: 入れ子（外側ほど長い）。山は中央の 1 点に集まる
    ads = [(3 * i, 10**9 - 7 * i, rng.randint(1, 9)) for i in range(100000)]
    rng.shuffle(ads)
    out.append(("hidden-max-nested", "hidden", fmt(ads)))
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
