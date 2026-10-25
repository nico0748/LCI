#!/usr/bin/env python3
"""cp-0022 入退場ログの最大滞在人数 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0022 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


DAY = 86400


def solve(inp: str) -> str:
    """想定解（いもす法）。diff[s] += 1、diff[t] -= 1（半開区間 [s, t)）を累積し、0〜86399 秒の人数を一度に作る"""
    t = inp.split()
    n = int(t[0])
    diff = [0] * (DAY + 1)  # t = 86400 を書き込むので 86401 要素
    for i in range(n):
        diff[int(t[1 + 2 * i])] += 1
        diff[int(t[2 + 2 * i])] -= 1
    cnt = [0] * DAY
    cur = 0
    for x in range(DAY):
        cur += diff[x]
        cnt[x] = cur
    peak = max(cnt)
    return f"{peak}\n{cnt.index(peak)}\n{cnt.count(peak)}\n"


def fmt(iv: list[tuple[int, int]]) -> str:
    return f"{len(iv)}\n" + "".join(f"{s} {e}\n" for s, e in iv)


def random_small(rng: SplitMix64) -> str:
    """幅 200 秒以内の窓（0 秒や 86400 秒に接する窓も出す）に、端点を共有しやすい区間を数個置く"""
    width = rng.randint(1, 200)
    where = rng.randint(0, 2)
    lo = 0 if where == 0 else DAY - width if where == 1 else rng.randint(0, DAY - width)
    pts = sorted({lo + rng.randint(0, width) for _ in range(rng.randint(2, 6))} | {lo, lo + width})
    iv = []
    for _ in range(rng.randint(1, 7)):
        a, b = rng.randint(0, len(pts) - 1), rng.randint(0, len(pts) - 1)
        if a == b:
            b = a + 1 if a + 1 < len(pts) else a - 1
        iv.append((pts[min(a, b)], pts[max(a, b)]))
    return fmt(iv)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1-half-open", "sample", "4\n10 20\n15 30\n20 25\n40 41\n"))
    out.append(("sample-2-closing", "sample", "3\n86000 86400\n86399 86400\n0 86400\n"))
    out.append(("sample-3-two-peaks", "sample", "5\n100 200\n150 160\n300 400\n350 360\n500 501\n"))
    rng = SplitMix64(0x5EED_0022)

    out.append(("hidden-min-1", "hidden", "1\n0 86400\n"))
    out.append(("hidden-edge-one-second", "hidden", "2\n86399 86400\n0 1\n"))
    # 前の人の退場と次の人の入場が同じ秒の鎖（閉区間で数えると境界で 2 人になる）
    out.append(("hidden-trap-half-open-chain", "hidden", fmt([(10 * i, 10 * i + 10) for i in range(1000)])))
    # 退場 86400（閉館）に集中し、最後の 1 秒が最大になる。配列が 86400 要素だと範囲外
    iv = [(DAY - rng.randint(1, 3600), DAY) for _ in range(300)] + [(rng.randint(0, 40000), rng.randint(40001, 80000)) for _ in range(200)]
    rng.shuffle(iv)
    out.append(("hidden-trap-closing-86400", "hidden", fmt(iv)))
    # 入場時刻がすべて同じ・退場がばらばら
    out.append(("hidden-trap-same-entry", "hidden", fmt([(3600, 3600 + rng.randint(1, 50000)) for _ in range(500)])))
    # 最大人数の時間帯が 3 か所に分かれる（総秒数は合計する。最初の秒は一番早い帯）
    iv = []
    for base in (70000, 20000, 45000):
        iv += [(base, base + 100), (base + 30, base + 70), (base + 50, base + 60)]
    iv += [(base + 200, base + 300) for base in (1000, 5000)]
    out.append(("hidden-trap-separate-peaks", "hidden", fmt(iv)))
    out.append(("hidden-edge-all-day", "hidden", fmt([(0, DAY)] * 1000)))
    for i in range(3):
        n = rng.randint(5, 40)
        iv = []
        for _ in range(n):
            a, b = rng.randint(0, DAY), rng.randint(0, DAY)
            while a == b:
                b = rng.randint(0, DAY)
            iv.append((min(a, b), max(a, b)))
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(iv)))
    iv = []
    for _ in range(3000):
        s = rng.randint(0, 1439) * 60
        iv.append((s, min(DAY, s + rng.randint(1, 180) * 60)))
    out.append(("hidden-mid-minutes", "hidden", fmt(iv)))
    # 最大: ほぼ一日中いる人が 2×10^5 人（1 人ずつ秒を塗ると 1.7×10^10 回）
    out.append(("hidden-max-long-stay", "hidden", fmt([(rng.randint(0, 999), DAY - rng.randint(0, 999)) for _ in range(200000)])))
    # 最大: 分単位の時刻（境界が重なる）で長さもばらばら
    iv = []
    for _ in range(200000):
        a, b = rng.randint(0, 1440) * 60, rng.randint(0, 1440) * 60
        while a == b:
            b = rng.randint(0, 1440) * 60
        iv.append((min(a, b), max(a, b)))
    out.append(("hidden-max-minute-grid", "hidden", fmt(iv)))
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
