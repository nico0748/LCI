#!/usr/bin/env python3
"""cp-0038 仕分け機の K 回後の合計 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0038 --naive` で hidden-max-* のどれかが TLE することを確かめる
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

MOD = 10 ** 9 + 7


def solve(inp: str) -> str:
    """想定解: 仕分け機 1 から訪問順を記録し、初めて再訪した時点で ρ の「尾」μ と「周期」λ が分かる。
    K < μ+λ なら記録した列をそのまま使い、それ以上なら周期の和 × 回数 ＋ 余りの部分"""
    tok = list(map(int, inp.split()))
    n, k = tok[0], tok[1]
    t = [0] + tok[2 : 2 + n]
    a = [0] + tok[2 + n : 2 + 2 * n]
    first = [-1] * (n + 1)  # 何回目の移動の前にいたか（x_j の j）
    order = []
    x = 1
    while first[x] < 0:
        first[x] = len(order)
        order.append(x)
        x = t[x]
    mu = first[x]  # 周期に入るまでの移動回数
    lam = len(order) - mu
    pre = [0]
    for v in order:
        pre.append(pre[-1] + a[v])
    if k <= len(order):
        return f"{t[order[k - 1]]} {pre[k] % MOD}\n"
    q, r = divmod(k - mu, lam)
    cyc = pre[mu + lam] - pre[mu]
    total = pre[mu] + q % MOD * (cyc % MOD) + (pre[mu + r] - pre[mu])
    return f"{order[mu + r]} {total % MOD}\n"


def render(k: int, t: list[int], a: list[int]) -> str:
    return f"{len(t)} {k}\n{' '.join(map(str, t))}\n{' '.join(map(str, a))}\n"


def rho(rng: SplitMix64, n: int, tail: int, cyc: int, amax: int) -> tuple[list[int], list[int]]:
    """仕分け機 1 から tail 台の尾 → cyc 台の周期。残りの仕分け機はランダムにどこかへ流れ込む"""
    assert tail + cyc <= n and cyc >= 1
    others = list(range(2, n + 1))
    rng.shuffle(others)
    path = [1] + others[: tail + cyc - 1]
    rest = others[tail + cyc - 1 :]
    t = [0] * (n + 1)
    for i in range(len(path) - 1):
        t[path[i]] = path[i + 1]
    t[path[-1]] = path[tail]
    for v in rest:
        t[v] = rng.randint(1, n)
    a = [rng.randint(0, amax) for _ in range(n)]
    return t[1:], a


def random_small(rng: SplitMix64) -> str:
    """N ≤ 8、K ≤ 40（brute は K 回そのまま進める）。ランダムな関数グラフ"""
    n = rng.randint(1, 8)
    t = [rng.randint(1, n) for _ in range(n)]
    a = [rng.randint(0, 10 ** 9) for _ in range(n)]
    return render(rng.randint(1, 40), t, a)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 5\n2 3 4 2\n10 20 30 40\n"))
    out.append(("sample-2", "sample", "3 1000000\n2 3 2\n1000000000 1 2\n"))
    rng = SplitMix64(0x5EED_0038)
    out.append(("hidden-min-1", "hidden", "1 1\n1\n7\n"))
    out.append(("hidden-edge-self-loop-k-max", "hidden", render(10 ** 18, [1], [10 ** 9])))
    # K が尾より短い（周期に入る前に終わる）。周期の公式に入れると WA
    t, a = rho(rng, 30, 20, 7, 10 ** 9)
    out.append(("hidden-trap-k-in-tail", "hidden", render(13, t, a)))
    # K がちょうど尾の長さ / 尾 + 周期の長さ（境界の off-by-one）
    t, a = rho(rng, 30, 12, 9, 10 ** 9)
    out.append(("hidden-trap-k-equals-tail", "hidden", render(12, t, a)))
    out.append(("hidden-trap-k-equals-tail-plus-cycle", "hidden", render(21, t, a)))
    # 尾が長く、最後に自己ループ
    t, a = rho(rng, 50, 49, 1, 10 ** 9)
    out.append(("hidden-trap-tail-then-self-loop", "hidden", render(10 ** 18, t, a)))
    # 周期の和 × 回数が 64bit を超える（回数を mod してから掛けないと溢れる）
    t, a = rho(rng, 1000, 3, 997, 10 ** 9)
    out.append(("hidden-trap-overflow-mul", "hidden", render(10 ** 18, t, a)))
    # K = 10^18 − 1: TS の Number では 10^18 に丸められ、余りの位置がずれる
    t, a = rho(rng, 20, 2, 7, 10 ** 9)
    out.append(("hidden-trap-bigint-k", "hidden", render(10 ** 18 - 1, t, a)))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_small(rng)))
    t, a = rho(rng, 20000, 7000, 9000, 10 ** 9)
    out.append(("hidden-mid-1", "hidden", render(rng.randint(10 ** 17, 10 ** 18), t, a)))
    n = 200000
    # 最大: 尾 10^5・周期 10^5、K = 10^18（K 回のシミュレーションは不可能）
    t, a = rho(rng, n, 100000, 100000, 999)
    out.append(("hidden-max-long-tail-cycle", "hidden", render(10 ** 18, t, a)))
    # 最大: 全員が 1 つの周期（尾なし）、K = 10^18 − 3
    t, a = rho(rng, n, 0, n, 99)
    out.append(("hidden-max-one-big-cycle", "hidden", render(10 ** 18 - 3, t, a)))
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
