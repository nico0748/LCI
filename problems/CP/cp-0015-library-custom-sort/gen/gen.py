#!/usr/bin/env python3
"""cp-0015 図書の並べ替え のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0015 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解。キー (ジャンルの順位, -年, 書名) で 1 回ソートする。一覧に無いジャンルは順位 G とし、同じ G の中はジャンル名で比べる"""
    tok = inp.split()
    g = int(tok[0])
    rank = {name: i for i, name in enumerate(tok[1 : 1 + g])}
    n = int(tok[1 + g])
    books = []
    p = 2 + g
    for _ in range(n):
        t, c, y = tok[p], tok[p + 1], int(tok[p + 2])
        p += 3
        r = rank.get(c, g)
        books.append((r, c if r == g else "", -y, t))
    books.sort()
    return "".join(b[3] + "\n" for b in books)


LOWER = "abcdefghijklmnopqrstuvwxyz"
ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" + LOWER


def make(genres: list[str], books: list[tuple[str, str, int]]) -> str:
    assert 1 <= len(genres) <= 50 and len(set(genres)) == len(genres)
    assert 1 <= len(books) <= 30000 and len({b[0] for b in books}) == len(books)
    for t, c, y in books:
        assert 1 <= len(t) <= 20 and set(t) <= set(ALNUM) and 1 <= len(c) <= 10 and set(c) <= set(LOWER) and 1 <= y <= 2026
    return f"{len(genres)}\n{' '.join(genres)}\n{len(books)}\n" + "".join(f"{t} {c} {y}\n" for t, c, y in books)


def rand_word(rng: SplitMix64, alphabet: str, lo: int, hi: int) -> str:
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(lo, hi)))


def random_books(rng: SplitMix64, n: int, pool: list[str], years: list[int], alphabet: str = ALNUM, lo: int = 1, hi: int = 6) -> list[tuple[str, str, int]]:
    titles: set[str] = set()
    out = []
    while len(out) < n:
        t = rand_word(rng, alphabet, lo, hi)
        if t in titles:
            continue
        titles.add(t)
        out.append((t, rng.choice(pool), rng.choice(years)))
    return out


def random_small(rng: SplitMix64) -> str:
    pool = ["sf", "art", "math", "food", "zoo", "a", "ab"]
    rng.shuffle(pool)
    g = rng.randint(1, 4)
    years = [rng.randint(1, 2026) for _ in range(3)] + [99, 100, 1000]
    return make(pool[:g], random_books(rng, rng.randint(1, 8), pool[: rng.randint(1, 7)], years, "aAbB09e", 1, 3))


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "2\nnovel history\n5\nRiver novel 2001\nHarbor history 1998\nSky novel 2015\nAtlas history 1998\nCastle novel 2001\n"))
    out.append(("sample-2-unlisted", "sample", "1\nart\n4\nMoss botany 2005\nWaves music 2020\nColor art 1990\nBach music 2020\n"))
    rng = SplitMix64(0x5EED_0015)
    out.append(("hidden-min-1", "hidden", make(["x"], [("A", "y", 1)])))
    # 一覧に無いジャンルが複数。入力順ではなくジャンル名の昇順で、一覧のジャンルの後ろに並ぶ
    books = [("Fog", "zen", 2000), ("Ink", "cook", 1999), ("Elm", "poem", 2001), ("Dune", "cook", 2010), ("Jade", "art", 1980), ("Bay", "zen", 2000), ("Cove", "art", 1980), ("Ash", "math", 1500)]
    out.append(("hidden-trap-unlisted-order", "hidden", make(["poem", "zen"], books)))
    # 大文字と小文字・数字が混ざる書名。文字コード順（数字 < 大文字 < 小文字）。localeCompare や大文字小文字を無視した比較は不正解
    titles = ["apple", "Banana", "banana", "Apple", "zeta", "Zeta", "9lives", "a1", "A1", "aB", "Ab", "AB", "ab", "b", "B", "0"]
    out.append(("hidden-trap-ascii-case", "hidden", make(["lit"], [(t, "lit", 2000) for t in titles])))
    # 年の桁数が違う（文字列のまま比べると "794" > "1200" になる）
    books = [("Kyo", "hist", 794), ("Edo", "hist", 1603), ("Nara", "hist", 710), ("Heian", "hist", 1185), ("Meiji", "hist", 1868), ("Asuka", "hist", 92), ("Jomon", "hist", 9), ("Reiwa", "hist", 2019)]
    out.append(("hidden-trap-year-digits", "hidden", make(["hist"], books)))
    # 数字だけ・指数表記に見える書名（PHP の <=> や sort() は "10" と "9"、"1e3" と "999" を数値として比べてしまう）
    titles = ["10", "9", "1e3", "999", "0100", "100", "1E2", "07", "7", "2e1", "20", "1e10"]
    out.append(("hidden-trap-numeric-titles", "hidden", make(["num"], [(t, "num", 1999) for t in titles])))
    # 同じジャンル・同じ年がたくさん → 書名で決まる。片方がもう片方の先頭部分の書名（"Book" < "Book2" < "Booka"）も入れる
    titles = ["Book", "Book2", "Booka", "BookA", "Boo", "Bo", "Bookshelf", "BOOK", "book"]
    books = [(t, "ref", 2020) for t in titles] + [(t + "x", "ref", 2021) for t in titles[:4]] + [(t + "y", "ref", 2019) for t in titles[:3]]
    out.append(("hidden-trap-ties-prefix", "hidden", make(["ref"], books)))
    # 一覧のジャンルが 1 冊も無い（全部「一覧に無いジャンル」）
    out.append(("hidden-edge-all-unlisted", "hidden", make(["qq", "rr"], random_books(rng, 12, ["sf", "art", "math"], [2000, 2001, 1000, 999]))))
    pool = [rand_word(rng, LOWER, 1, 4) for _ in range(8)]
    pool = list(dict.fromkeys(pool))
    for i in range(3):
        rng.shuffle(pool)
        listed = pool[: rng.randint(1, 5)]
        out.append((f"hidden-rand-{i + 1}", "hidden", make(listed, random_books(rng, rng.randint(10, 40), pool, [rng.randint(1, 2026) for _ in range(6)] + [2026, 1]))))
    pool = list(dict.fromkeys(rand_word(rng, LOWER, 1, 10) for _ in range(60)))
    rng.shuffle(pool)
    out.append(("hidden-mid-1", "hidden", make(pool[:20], random_books(rng, 2000, pool, list(range(1, 2027)), ALNUM, 1, 10))))
    out.append(("hidden-max-random", "hidden", make(pool[:50], random_books(rng, 30000, pool, list(range(1, 2027)), ALNUM, 3, 12))))
    # 最大: ジャンル 3 つ・年は 5 通りだけ（同じジャンル・同じ年が 2000 冊ずつ並び、書名の比較が効く）
    out.append(("hidden-max-few-keys", "hidden", make(["sf", "zz"], random_books(rng, 30000, ["sf", "zz", "aa"], [999, 1000, 2026, 1, 50], "aAzZ019", 1, 9))))
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
