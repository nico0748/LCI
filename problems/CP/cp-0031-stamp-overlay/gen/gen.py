#!/usr/bin/env python3
"""cp-0031 スタンプの重ね押し のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0031 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: スタンプを入力順に上から塗る。キャンバス外（負の座標を含む）は添字の範囲で弾く"""
    tok = inp.split()
    h_, w_, n = int(tok[0]), int(tok[1]), int(tok[2])
    canvas = [["."] * w_ for _ in range(h_)]
    p = 3
    for _ in range(n):
        h, w, r, c = (int(x) for x in tok[p : p + 4])
        p += 4
        for i in range(h):
            row = tok[p + i]
            y = r - 1 + i
            if not 0 <= y < h_:
                continue  # Python の負の添字は末尾の行を指してしまうので、範囲で必ず弾く
            cr = canvas[y]
            for j, ch in enumerate(row):
                x = c - 1 + j
                if ch != "." and 0 <= x < w_:
                    cr[x] = ch
        p += h
    return "\n".join("".join(r) for r in canvas) + "\n"


CHARS = "AB#."


def stamp_text(rng: SplitMix64, h: int, w: int, chars: str = CHARS) -> list[str]:
    return ["".join(rng.choice(chars) for _ in range(w)) for _ in range(h)]


def render(hh: int, ww: int, stamps: list[tuple[int, int, list[str]]]) -> str:
    """stamps: (r, c, 絵柄の行のリスト)"""
    lines = [f"{hh} {ww} {len(stamps)}"]
    for r, c, rows in stamps:
        lines.append(f"{len(rows)} {len(rows[0])} {r} {c}")
        lines.extend(rows)
    return "\n".join(lines) + "\n"


def random_case(rng: SplitMix64, hmax: int, wmax: int, nmax: int, smax: int, lo: int, hi: int, chars: str = CHARS) -> str:
    hh, ww = rng.randint(1, hmax), rng.randint(1, wmax)
    stamps = []
    for _ in range(rng.randint(1, nmax)):
        h, w = rng.randint(1, smax), rng.randint(1, smax)
        stamps.append((rng.randint(lo, hi), rng.randint(lo, hi), stamp_text(rng, h, w, chars)))
    return render(hh, ww, stamps)


def random_small(rng: SplitMix64) -> str:
    """stress 用: キャンバス 6×6 まで、座標は -5〜8（はみ出し・負の座標が頻繁に出る）"""
    return random_case(rng, 6, 6, 5, 5, -5, 8)


def same(a: str, b: str) -> bool:
    """compare.mode = exact と同じ（行末の空白と末尾の改行だけ無視）"""
    norm = lambda s: [line.rstrip(" \t") for line in s.replace("\r\n", "\n").rstrip("\n").split("\n")]
    return norm(a) == norm(b)


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "4 6 2\n3 3 1 1\n###\n#.#\n###\n2 4 2 2\nXX.X\n.XX.\n"))
    out.append(("sample-2", "sample", "3 3 2\n2 2 0 0\nAB\nCD\n3 2 2 3\nEF\nGH\nIJ\n"))
    out.append(("sample-3-outside", "sample", "2 3 1\n1 2 3 4\nZZ\n"))
    rng = SplitMix64(0x5EED_0031)
    out.append(("hidden-min-1", "hidden", "1 1 1\n1 1 1 1\nQ\n"))
    out.append(("hidden-edge-all-transparent", "hidden", render(3, 4, [(1, 1, ["ABCD", "EFGH", "IJKL"]), (1, 1, ["....", "....", "...."])])))
    out.append(("hidden-edge-all-outside", "hidden", render(4, 4, [(5, 1, ["AA"]), (1, 5, ["B", "B"]), (-2, 1, ["CC", "CC"]), (2, -1, ["DD", "DD"]), (-100, -100, ["EEE"]), (100, 100, ["F"])])))
    # 負の座標: Python の canvas[-1] は最後の行、TS/JS の配列は負の添字で黙って無視しない（プロパティになる）など
    out.append(("hidden-trap-negative", "hidden", render(5, 5, [(-1, -1, ["ABC", "DEF", "GHI"]), (0, 4, ["JK.", "LMN"]), (-3, 2, ["OO", "PP", "QQ", "RR", "SS"])])))
    # 右端・下端からのはみ出し: C で行をまたいで隣の行に書いてしまう、範囲外アクセスで落ちる、など
    out.append(("hidden-trap-clip-right-bottom", "hidden", render(4, 5, [(3, 4, ["ABCD", "EFGH", "IJKL"]), (1, 5, ["XYZ", "XYZ"]), (4, -2, ["MNOPQRSTU"])])))
    # '.' は透過: 下の文字を消してはいけない
    out.append(("hidden-trap-transparent", "hidden", render(5, 7, [(1, 1, ["AAAAAAA", "AAAAAAA", "AAAAAAA", "AAAAAAA", "AAAAAAA"]), (2, 2, [".B.B.", "B.B.B", ".B.B."]), (1, 1, ["#.....#", ".......", ".......", ".......", "#.....#"])])))
    # 後から押したものが上: 逆順に塗る・最初の文字を残すと WA
    out.append(("hidden-trap-order", "hidden", render(3, 3, [(1, 1, ["AAA", "AAA", "AAA"]), (1, 1, ["BB", "BB"]), (2, 2, ["CC", "CC"]), (2, 2, ["D"]), (1, 3, ["E", ".", "E"])])))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", random_case(rng, 10, 10, 8, 8, -8, 12)))
    out.append(("hidden-mid-1", "hidden", random_case(rng, 30, 30, 20, 20, -20, 35, "ABCDEFGHIJ#..")))
    # 最大: 50×50 のキャンバスに 50 個。大きさ・位置はばらばら（座標は -50〜100 の全域から）
    hh, ww = 50, 50
    stamps = []
    for _ in range(50):
        h, w = rng.randint(1, 50), rng.randint(1, 50)
        stamps.append((rng.randint(-50, 60), rng.randint(-50, 60), stamp_text(rng, h, w, "ABCDEFGHIJKLMNOPQRSTUVWXYZ#....")))
    out.append(("hidden-max-mixed", "hidden", render(hh, ww, stamps)))
    # 最大: 50×50 のスタンプを 30 個、ずらしながら重ねる（負の座標・右下のはみ出しを含む）
    stamps = []
    for k in range(30):
        r, c = rng.randint(-25, 26), rng.randint(-25, 26)
        letter = chr(ord("A") + k % 26)
        stamps.append((r, c, stamp_text(rng, 50, 50, letter + "..")))
    out.append(("hidden-max-full-stamps", "hidden", render(hh, ww, stamps)))
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
