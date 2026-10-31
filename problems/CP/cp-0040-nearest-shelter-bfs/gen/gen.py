#!/usr/bin/env python3
"""cp-0040 最寄りの避難所 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0040 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: すべての避難所を距離 0 として同時にキューへ入れる多始点 BFS（段ごと）"""
    lines = inp.split()
    h, w = int(lines[0]), int(lines[1])
    grid = lines[2 : 2 + h]
    W2 = w + 2
    ok = bytearray(W2 * (h + 2))  # 1 = まだ訪れていない通れるマス。周りを壁で囲む
    cur = []
    dots = 0
    for i, row in enumerate(grid):
        base = (i + 1) * W2 + 1
        for j, ch in enumerate(row):
            if ch == ".":
                ok[base + j] = 1
                dots += 1
            elif ch == "S":
                cur.append(base + j)
    if not cur:
        return f"-1 {dots}\n"
    reached = 0
    d = 0
    while True:
        nxt = []
        for p in cur:
            for q in (p - 1, p + 1, p - W2, p + W2):
                if ok[q]:
                    ok[q] = 0
                    nxt.append(q)
        if not nxt:
            break
        reached += len(nxt)
        d += 1
        cur = nxt
    return f"{d} {dots - reached}\n"


def render(rows: list[str]) -> str:
    return f"{len(rows)} {len(rows[0])}\n" + "\n".join(rows) + "\n"


def random_grid(rng: SplitMix64, h: int, w: int, pwall: int, pshelter: int) -> list[str]:
    """pwall / pshelter は 1000 分率"""
    rows = []
    for _ in range(h):
        row = []
        for _ in range(w):
            x = rng.randint(0, 999)
            row.append("#" if x < pwall else "S" if x < pwall + pshelter else ".")
        rows.append("".join(row))
    return rows


def random_small(rng: SplitMix64) -> str:
    """6×6 まで。壁は多め、避難所は 0〜数個（避難所なし・囲まれたマスが頻繁に出る）"""
    h, w = rng.randint(1, 6), rng.randint(1, 6)
    return render(random_grid(rng, h, w, rng.randint(0, 500), rng.choice([0, 30, 100])))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def snake(h: int, w: int) -> list[str]:
    """蛇行した 1 本道（偶数行は全部道、奇数行は端の 1 マスだけ開く）。左上に避難所を 1 つ"""
    rows = []
    for i in range(h):
        if i % 2 == 0:
            rows.append("." * w)
        else:
            open_right = (i // 2) % 2 == 0
            rows.append("#" * (w - 1) + "." if open_right else "." + "#" * (w - 1))
    rows[0] = "S" + rows[0][1:]
    return rows


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 5\nS..#.\n.#.#.\n...#.\n##..S\n"))
    out.append(("sample-2-no-shelter", "sample", "2 3\n..#\n#..\n"))
    rng = SplitMix64(0x5EED_0040)
    out.append(("hidden-min-shelter", "hidden", "1 1\nS\n"))
    out.append(("hidden-min-dot", "hidden", "1 1\n.\n"))
    out.append(("hidden-min-wall", "hidden", "1 1\n#\n"))
    # 避難所が 1 つも無い（D = -1、U = 道のマスの数）
    out.append(("hidden-edge-no-shelter", "hidden", render(random_grid(rng, 30, 40, 300, 0))))
    # 壁で囲まれた道のマス（どこにも行けない）が点在する
    out.append(("hidden-trap-enclosed", "hidden", render(["S.#.#....", "..#.#.###", "###.#.#.#", "....#.###", "#####....", "..S#.#.#.", "...#.....", "####.###."])))
    # 避難所どうしが隣り合う・避難所だけで道が無い列など、距離 0 の扱い
    out.append(("hidden-trap-shelter-only", "hidden", render(["SS#", "S#S", "#SS"])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", render(random_grid(rng, rng.randint(5, 20), rng.randint(5, 20), 250, 15))))
    out.append(("hidden-mid-1", "hidden", render(random_grid(rng, 200, 200, 300, 2))))
    # 最大: 1000×1000 の蛇行した 1 本道、避難所 1 つ（距離は約 5×10^5。BFS のキューが長い）
    out.append(("hidden-max-snake", "hidden", render(snake(1000, 1000))))
    # 最大: 避難所が約 1 万個（避難所ごとに BFS すると 10^4 × 10^6 回で TLE）
    out.append(("hidden-max-many-shelters", "hidden", render(random_grid(rng, 1000, 1000, 200, 10))))
    # 最大: 壁なし、右下の角に避難所 1 つ（距離 1998）
    rows = ["." * 1000 for _ in range(1000)]
    rows[999] = "." * 999 + "S"
    out.append(("hidden-max-open", "hidden", render(rows)))
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
