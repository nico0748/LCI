#!/usr/bin/env python3
"""cp-0014 次の発車時刻 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0014 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


def to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def hhmm(x: int) -> str:
    return f"{x // 60:02d}:{x % 60:02d}"


def solve(inp: str) -> str:
    """想定解。発車時刻を分に直してソートし、照会ごとに「照会時刻以上で最初の便」を探す。無ければ翌日の始発（+1440 分）"""
    tok = inp.split()
    n = int(tok[0])
    deps = sorted(to_min(s) for s in tok[1 : 1 + n])
    q = int(tok[1 + n])
    out = []
    for s in tok[2 + n : 2 + n + q]:
        u = to_min(s)
        nxt = next((d for d in deps if d >= u), None)
        if nxt is None:
            out.append(f"{hhmm(deps[0])} {deps[0] + 1440 - u}")
        else:
            out.append(f"{hhmm(nxt)} {nxt - u}")
    return "\n".join(out) + "\n"


def make(deps: list[int], queries: list[int]) -> str:
    assert 1 <= len(deps) <= 100 and 1 <= len(queries) <= 100
    assert all(0 <= x < 1440 for x in deps + queries)
    return "\n".join([str(len(deps)), *map(hhmm, deps), str(len(queries)), *map(hhmm, queries)]) + "\n"


def random_small(rng: SplitMix64) -> str:
    # 時刻の範囲を狭くした回と全日の回を混ぜ、ちょうど・日付またぎが出やすいようにする
    if rng.randint(0, 1):
        base = rng.randint(0, 1439)
        pick = lambda: (base + rng.randint(-5, 5)) % 1440  # noqa: E731
    else:
        pick = lambda: rng.randint(0, 1439)  # noqa: E731
    deps = [pick() for _ in range(rng.randint(1, 5))]
    return make(deps, [pick() for _ in range(rng.randint(1, 5))])


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "3\n08:15\n07:50\n12:00\n3\n07:30\n08:00\n09:01\n"))
    out.append(("sample-2-next-day", "sample", "2\n06:05\n22:40\n2\n23:10\n00:00\n"))
    rng = SplitMix64(0x5EED_0014)
    out.append(("hidden-min-1", "hidden", make([0], [0])))
    # 便が 1 本だけで、照会がその 1 分後 → 翌日の同じ便まで 1439 分
    out.append(("hidden-edge-wait-1439", "hidden", make([725], [726, 725, 724])))
    # ちょうどの時刻は乗れる（> で比べると次の便や翌日に回ってしまう）
    deps = [rng.randint(0, 1439) for _ in range(12)]
    out.append(("hidden-trap-exact-time", "hidden", make(deps, sorted(deps, reverse=True))))
    # 最終便のあと → 翌日の始発。待ち時間は 1440 を足して数える
    deps = [300, 365, 1100, 1380, 1439]
    out.append(("hidden-trap-next-day", "hidden", make(deps, [1439, 1400, 1381, 0, 299, 300, 1100])))
    # 0 埋め: 時・分のどちらかが 1 桁になる便ばかり（"5:7" と出すと不正解）
    deps = [0, 7, 65, 307, 549, 600, 601]
    out.append(("hidden-trap-zero-pad", "hidden", make(deps, [0, 1, 8, 66, 306, 550, 602, 599])))
    # 入力が時刻順に並んでいない（入力順で最初に見つかった「照会以降の便」を答えると不正解）
    deps = [1200, 400, 900, 401, 1300, 60, 899]
    out.append(("hidden-trap-unsorted", "hidden", make(deps, [59, 61, 399, 402, 898, 1000, 1250, 1301])))
    out.append(("hidden-edge-duplicate-deps", "hidden", make([480, 480, 480, 1020, 1020], [480, 479, 481, 1021])))
    for i in range(3):
        deps = [rng.randint(0, 1439) for _ in range(rng.randint(3, 20))]
        qs = [rng.randint(0, 1439) for _ in range(rng.randint(3, 20))]
        out.append((f"hidden-rand-{i + 1}", "hidden", make(deps, qs)))
    deps = [rng.randint(0, 1439) for _ in range(100)]
    out.append(("hidden-max-random", "hidden", make(deps, [rng.randint(0, 1439) for _ in range(100)])))
    deps = [rng.randint(360, 1380) for _ in range(100)]
    qs = [rng.choice(deps) for _ in range(40)] + [rng.randint(1381, 1439) for _ in range(30)] + [rng.randint(0, 359) for _ in range(30)]
    rng.shuffle(qs)
    out.append(("hidden-max-boundaries", "hidden", make(deps, qs)))
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
