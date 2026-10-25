#!/usr/bin/env python3
"""cp-0024 パスワード強度チェック のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0024 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


SYMBOLS = "!#$%&*+-=?@_"


def check(user: str, pw: str) -> str:
    """想定解。規則 1〜5 を順に 1 つずつ確かめ、最初に破った番号を返す（どれも破らなければ OK）"""
    if not 8 <= len(pw) <= 64:
        return "1"
    if any(not (c.isascii() and c.isalnum()) and c not in SYMBOLS for c in pw):
        return "2"
    kinds = sum(
        [
            any("A" <= c <= "Z" for c in pw),
            any("a" <= c <= "z" for c in pw),
            any("0" <= c <= "9" for c in pw),
            any(c in SYMBOLS for c in pw),
        ]
    )
    if kinds < 3:
        return "3"
    run = 1
    for i in range(1, len(pw)):
        run = run + 1 if pw[i] == pw[i - 1] else 1
        if run >= 3:
            return "4"
    if user.lower() in pw.lower():
        return "5"
    return "OK"


def solve(inp: str) -> str:
    lines = inp.split("\n")
    n = int(lines[0])
    out = []
    for i in range(1, n + 1):
        user, pw = lines[i].split(" ")
        out.append(check(user, pw))
    return "\n".join(out) + "\n"


ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
PRINTABLE = "".join(chr(c) for c in range(0x21, 0x7F))
BAD = "".join(c for c in PRINTABLE if not c.isalnum() and c not in SYMBOLS)


def fmt(rows: list[tuple[str, str]]) -> str:
    return f"{len(rows)}\n" + "".join(f"{u} {p}\n" for u, p in rows)


def rand_from(rng: SplitMix64, alphabet: str, n: int) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def random_user(rng: SplitMix64) -> str:
    return rand_from(rng, ALNUM, rng.randint(3, 16))


def strong(rng: SplitMix64, n: int) -> str:
    """規則 1〜4 をほぼ満たす（4 種の文字を混ぜ、3 連続を作らない）パスワード"""
    pools = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", SYMBOLS]
    s: list[str] = []
    while len(s) < n:
        c = rng.choice(pools[len(s) % 4] if len(s) < 4 else rng.choice(pools))
        if len(s) >= 2 and s[-1] == s[-2] == c:
            continue
        s.append(c)
    rng.shuffle(s)
    return "".join(s)


def tweak(rng: SplitMix64, user: str, pw: str) -> str:
    """どれかの規則を破りやすくする小さな変更を 0〜2 個入れる"""
    for _ in range(rng.randint(0, 2)):
        k = rng.randint(0, 5)
        p = rng.randint(0, len(pw))
        if k == 0:  # 3 連続（末尾も出る）
            c = rng.choice(pw) if pw else "a"
            pw = pw[:p] + c * rng.randint(2, 3) + pw[p:]
        elif k == 1:  # ユーザー名を大文字小文字を変えて埋め込む
            u = "".join(c.upper() if rng.randint(0, 1) else c.lower() for c in user)
            pw = pw[:p] + u + pw[p:]
        elif k == 2:  # 使えない記号
            pw = pw[:p] + rng.choice(BAD) + pw[p:]
        elif k == 3:  # 文字種を減らす
            pw = "".join(c.lower() if c.isalpha() else c for c in pw) if rng.randint(0, 1) else "".join(c for c in pw if c.isalnum())
        elif k == 4:  # 長さを境界に寄せる
            pw = pw[: rng.choice([7, 8, 64, 65])]
        else:
            pw = pw + rng.choice(PRINTABLE)
    return pw or "a"


def random_small(rng: SplitMix64) -> str:
    rows = []
    for _ in range(rng.randint(1, 6)):
        user = random_user(rng) if rng.randint(0, 3) else rand_from(rng, "ab", rng.randint(3, 4))
        if rng.randint(0, 4) == 0:
            pw = rand_from(rng, "aA1!~b", rng.randint(1, 12))
        else:
            pw = tweak(rng, user, strong(rng, rng.choice([6, 7, 8, 9, 12, 20, 63, 64, 65, 70])))
        rows.append((user, pw[:100]))
    return fmt(rows)


def random_rows(rng: SplitMix64, n: int, lmax: int) -> list[tuple[str, str]]:
    rows = []
    for _ in range(n):
        user = random_user(rng)
        rows.append((user, tweak(rng, user, strong(rng, rng.randint(5, lmax)))[:100]))
    return rows


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "6\nalice Abcdefg1\nalice Abcdef1\nbob Passw0rd~\ncarol Aa1aaa2b\ndave xDAVEx12Q\nerin Zz9!Zz9!\n"))
    out.append(("sample-2-order", "sample", "4\nkai abcdefgh12\nkai Kai\nmei Mei2025!!!\nsora SoRa_1234\n"))
    rng = SplitMix64(0x5EED_0024)

    out.append(("hidden-min-1", "hidden", "1\nabc Xy7_Xy7_\n"))
    base = "Aa1_Bb2-Cc3?"
    rows = [("len", (base * 6)[:k]) for k in (7, 8, 9, 63, 64, 65, 100)]
    out.append(("hidden-trap-length-boundary", "hidden", fmt(rows)))
    rows = [
        ("order", "a~a"),  # 1 と 2 を破る → 1
        ("order", "~~~aaaaaa"),  # 2・3・4 → 2
        ("order", "aaa111bbb"),  # 3・4 → 3
        ("Order", "Xorder111z"),  # 4・5 → 4
        ("Order", "aB3_ORDER"),  # 5 だけ
        ("order", "ORDER" + "x" * 60),  # 1（65 文字）・3・4・5 → 1
        ("q1w", "q1W(Q1w)E2r"),  # 2・5 → 2
    ]
    out.append(("hidden-trap-rule-order", "hidden", fmt(rows)))
    rows = [
        ("TaRo", "xxTAROxx9!"),
        ("taro", "tArO_2024A"),
        ("Taro", "Ta_ro2024A"),  # 間に _ があるので含まない
        ("ken", "Kenken12!!"),  # 5 より前に 4（!! は 2 連続なので 4 ではない）→ 5
        ("abcdefghijklmnop", "Abcdefghij1!"),  # ユーザー名がパスワードより長い
        ("Zz9", "zZ9#zz9#Q"),
    ]
    out.append(("hidden-trap-username-case", "hidden", fmt(rows)))
    rows = [
        ("tail", "Abc_12345!!!"),
        ("tail", "Abc_12345!!"),
        ("tail", "Abc_12345zzz"),
        ("tail", "Abc_1234500"),
        ("tail", "Abc_123ZZZ"),
        ("tail", "AAAbc_123"),
        ("tail", "Ab_1Ab_1aaaa"),
        ("tail", "aAaB1_xyz"),  # 大文字小文字が違えば同じ文字ではない
        ("tail", "x1_X1_1111"),
    ]
    out.append(("hidden-trap-tail-run", "hidden", fmt(rows)))
    rows = [("sym", "Abc12345" + c) for c in BAD] + [("sym", "abc12345" + c) for c in SYMBOLS]
    out.append(("hidden-edge-every-symbol", "hidden", fmt(rows)))
    rows = [
        ("kinds", "abcdefgh"),
        ("kinds", "ABCDEFGH"),
        ("kinds", "12345678"),
        ("kinds", "!#$%&*+-"),
        ("kinds", "abcd1234"),
        ("kinds", "ABCD!@#$"),
        ("kinds", "abcD1234"),
        ("kinds", "abcd12_4"),
        ("kinds", "ABCD12_4"),
    ]
    out.append(("hidden-trap-three-kinds", "hidden", fmt(rows)))
    for i in range(3):
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(random_rows(rng, rng.randint(10, 30), 70))))
    out.append(("hidden-max-mixed", "hidden", fmt(random_rows(rng, 100, 100))))
    rows = []
    for _ in range(100):
        user = random_user(rng)
        pw = strong(rng, rng.randint(60, 100))
        rows.append((user, pw[: rng.choice([63, 64, 65, 100])]))
    out.append(("hidden-max-long", "hidden", fmt(rows)))
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
