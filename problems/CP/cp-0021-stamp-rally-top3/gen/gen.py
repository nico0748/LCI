#!/usr/bin/env python3
"""cp-0021 スタンプラリー上位 3 名 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0021 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    t = inp.split()
    n, m = int(t[0]), int(t[1])
    p = [int(x) for x in t[2 : 2 + m]]
    logs = [(t[2 + m + 2 * i], int(t[3 + m + 2 * i])) for i in range(n)]
    return n, m, p, logs


def solve(inp: str) -> str:
    """想定解。名前 → 得点の辞書に、(名前, 地点) の集合で重複を除いて足し込み、(-得点, 名前) で並べて先頭 3 件"""
    _, _, p, logs = parse(inp)
    seen: set[tuple[str, int]] = set()
    score: dict[str, int] = {}
    for name, c in logs:
        if (name, c) in seen:
            continue
        seen.add((name, c))
        score[name] = score.get(name, 0) + p[c - 1]
    top = sorted(score.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    return "".join(f"{name} {s}\n" for name, s in top)


SHORT_NAMES = ["a", "b", "aa", "ab", "ba", "abc", "bab", "c"]


def fmt(m: int, p: list[int], logs: list[tuple[str, int]]) -> str:
    lines = [f"{len(logs)} {m}", " ".join(map(str, p))]
    lines += [f"{s} {c}" for s, c in logs]
    return "\n".join(lines) + "\n"


def random_name(rng: SplitMix64, lo: int = 1, hi: int = 10) -> str:
    return "".join(chr(97 + rng.randint(0, 25)) for _ in range(rng.randint(lo, hi)))


def random_small(rng: SplitMix64) -> str:
    """名前は接頭辞が重なる短い名前から、点は 1〜3 にして同点を起きやすくする"""
    n = rng.randint(1, 12)
    m = rng.randint(1, 4)
    p = [rng.randint(1, 3) for _ in range(m)]
    pool = SHORT_NAMES[: rng.randint(1, len(SHORT_NAMES))]
    logs = [(rng.choice(pool), rng.randint(1, m)) for _ in range(n)]
    return fmt(m, p, logs)


def random_case(rng: SplitMix64, n: int, m: int, names: int, pmax: int) -> str:
    pool: list[str] = []
    while len(pool) < names:
        s = random_name(rng)
        if s not in pool:
            pool.append(s)
    p = [rng.randint(1, pmax) for _ in range(m)]
    logs = [(rng.choice(pool), rng.randint(1, m)) for _ in range(n)]
    return fmt(m, p, logs)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "6 3\n10 20 30\nhana 1\ntaro 2\nhana 3\nken 1\ntaro 2\nken 3\n"))
    out.append(("sample-2-fewer", "sample", "3 2\n5 7\nmio 2\nmio 2\nmio 1\n"))
    out.append(("sample-3-tie", "sample", "7 2\n15 15\nann 1\nan 2\nbob 1\nbob 2\nann 2\ncy 1\nan 1\n"))
    rng = SplitMix64(0x5EED_0021)

    out.append(("hidden-min-1", "hidden", "1 1\n50\nzed 1\n"))
    # 1 人が全地点を何度も押す（重複を数えると 20 地点の合計を超える）
    p = [rng.randint(1, 100) for _ in range(20)]
    logs = [("solo", c) for c in range(1, 21)] + [("solo", rng.randint(1, 20)) for _ in range(30)]
    rng.shuffle(logs)
    out.append(("hidden-edge-single-person", "hidden", fmt(20, p, logs)))
    # 3 位が 4 人で同点: 名前順で 2 人だけ入る
    logs = [("rin", 1), ("rin", 2), ("rin", 3), ("rin", 4)]
    for name in ["mika", "aki", "ren", "ai"]:
        logs += [(name, 1), (name, 3), (name, 5)]
    rng.shuffle(logs)
    out.append(("hidden-trap-tie-at-third", "hidden", fmt(5, [10, 10, 10, 10, 10], logs)))
    # 参加者が 2 人だけ（3 行出そうとして落ちる・空行を出す）
    logs = [("yui", rng.randint(1, 6)) for _ in range(15)] + [("sho", rng.randint(1, 6)) for _ in range(15)]
    rng.shuffle(logs)
    out.append(("hidden-trap-fewer-than-3", "hidden", fmt(6, [3, 1, 4, 1, 5, 9], logs)))
    # 同じ名前がばらばらに現れる。連続した行だけをまとめると、部分和が別人として並ぶ
    logs = []
    for c in range(1, 9):
        for name in ["kai", "nao", "emi", "jun"]:
            logs.append((name, c))
    logs += [("emi", 9), ("jun", 9), ("jun", 10)]
    out.append(("hidden-trap-merge-same-name", "hidden", fmt(10, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29], logs)))
    # 100 点の地点を何度も押す人。重複を数えると 1 位になってしまう
    logs = [("spam", 1)] * 12 + [("spam", 2)]
    logs += [("tomo", c) for c in (1, 3, 4, 5)] + [("haru", c) for c in (1, 2, 3, 5)] + [("sena", c) for c in (1, 4, 5)]
    rng.shuffle(logs)
    out.append(("hidden-trap-duplicate-stamp", "hidden", fmt(5, [100, 20, 60, 50, 40], logs)))
    # 接頭辞が同じ名前の同点（短い方が先: a < aa < aaa < ab < b）
    logs = []
    for name in ["b", "ab", "aaa", "aa", "a"]:
        logs += [(name, 1), (name, 2)]
    rng.shuffle(logs)
    out.append(("hidden-trap-name-prefix", "hidden", fmt(2, [7, 8], logs)))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_case(rng, rng.randint(20, 60), rng.randint(2, 8), rng.randint(3, 12), 5)))
    out.append(("hidden-mid-1", "hidden", random_case(rng, 300, 12, 40, 30)))
    out.append(("hidden-max-many-names", "hidden", random_case(rng, 1000, 20, 500, 100)))
    out.append(("hidden-max-ties", "hidden", random_case(rng, 1000, 20, 120, 1)))
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
