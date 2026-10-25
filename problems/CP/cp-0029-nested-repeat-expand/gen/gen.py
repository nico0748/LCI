#!/usr/bin/env python3
"""cp-0029 入れ子の繰り返し記法の展開 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0029 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


import re

LIMIT = 100000


def solve(inp: str) -> str:
    """想定解（スタック）。'(' で新しい層を積み、')' で層を閉じて回数分つなげ、1 つ下の層に足す"""
    s = inp.split()[0]
    stack: list[list[str]] = [[]]
    counts: list[int] = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch.isdigit():
            j = i
            while s[j].isdigit():
                j += 1
            k = int(s[i:j])
            if s[j] == "(":
                counts.append(k)
                stack.append([])
            else:
                stack[-1].append(s[j] * k)
            i = j + 1
        elif ch == ")":
            body = "".join(stack.pop())
            stack[-1].append(body * counts.pop())
            i += 1
        else:
            stack[-1].append(ch)
            i += 1
    return "".join(stack[0]) + "\n"


def letters(rng: SplitMix64, n: int, pool: str = "abcdefghijklmnopqrstuvwxyz") -> str:
    return "".join(rng.choice(pool) for _ in range(n))


def rand_expr(rng: SplitMix64, depth: int, items: int, kmax: int, budget: int) -> tuple[str, int]:
    """記法の文字列と展開後の長さ。展開後が budget を超えない範囲で、文字・「k 文字」・「k(…)」を並べる"""
    out: list[str] = []
    total = 0
    for _ in range(rng.randint(1, items)):
        r = rng.randint(0, 5)
        if r <= 1 or depth == 0 and r >= 4:
            piece, length = letters(rng, 1), 1
        elif r <= 3:
            k = rng.randint(1, kmax)
            piece, length = f"{k}{letters(rng, 1)}", k
        else:
            inner, il = rand_expr(rng, depth - 1, items, kmax, max(1, (budget - total) // 2))
            k = rng.randint(1, max(1, min(kmax, (budget - total) // il)))
            piece, length = f"{k}({inner})", k * il
        if total + length > budget:
            if out:
                break
            piece, length = letters(rng, 1), 1
        out.append(piece)
        total += length
    return "".join(out), total


def random_small(rng: SplitMix64) -> str:
    s, _ = rand_expr(rng, rng.randint(0, 4), 4, rng.choice([1, 3, 12]), 200)
    return s + "\n"


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def deep(rng: SplitMix64, levels: int, inner: str, grow: int) -> str:
    """levels 段の入れ子。各段は「k(前 + 内側 + 後)」。grow% の確率で k = 2（展開後が LIMIT を超えないときだけ）"""
    s, length = inner, len(inner)
    for _ in range(levels):
        pre, post = letters(rng, rng.randint(0, 1)), letters(rng, rng.randint(0, 1))
        body = length + len(pre) + len(post)
        k = 2 if rng.randint(1, 100) <= grow and 2 * body <= LIMIT else 1
        s, length = f"{k}({pre}{s}{post})", k * body
    return s


def wide(rng: SplitMix64, size: int) -> str:
    """|S| が size 近くになるまで、展開後の合計が LIMIT を超えない範囲で項目を並べる"""
    out, slen, total = [], 0, 0
    while slen < size - 12:
        piece, length = rand_expr(rng, 2, 3, 40, max(1, min(2500, LIMIT - total)))
        if rng.randint(0, 9) == 0 and total + 999 <= LIMIT:
            piece, length = f"999{letters(rng, 1)}", 999
        if slen + len(piece) > size or total + length > LIMIT:
            piece, length = letters(rng, 1), 1
            if total + 1 > LIMIT:
                break
        out.append(piece)
        slen += len(piece)
        total += length
    return "".join(out)


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "2(ab3c)d\n"))
    out.append(("sample-2-multi-digit", "sample", "3(x2(yz))w10q\n"))
    out.append(("sample-3-count-one", "sample", "1(a1(b))2(c)\n"))
    rng = SplitMix64(0x5EED_0029)

    out.append(("hidden-min-1", "hidden", "a\n"))
    out.append(("hidden-edge-plain", "hidden", letters(rng, 1000) + "\n"))
    out.append(("hidden-trap-multi-digit", "hidden", "12(3(a)b)100(z)999y10(10(x))\n"))
    # 50 段の入れ子（回数 1 と 2 が混ざる）
    out.append(("hidden-trap-deep-nest", "hidden", deep(rng, 50, "q", 25) + "\n"))
    # ) の直後の文字・数字（回数は直後の 1 要素にだけ掛かる）
    out.append(("hidden-trap-after-paren", "hidden", "2(ab)c3(d)e2(f2(g)h)ij4(k)5l2(2(m)n)op\n"))
    out.append(("hidden-trap-count-one", "hidden", "1(" * 50 + "a" + ")" * 50 + "1b1(c)1d\n"))
    out.append(("hidden-trap-adjacent-groups", "hidden", "2(a)3(b)4(c)2(3(d)4(e))5(f)1(2(g)3(h))\n"))
    # 数字の直後が英小文字のときは、その 1 文字だけを繰り返す（3ab は aaab）
    out.append(("hidden-trap-letter-count", "hidden", "3ab2(3ab)c11z2(4x)y\n"))
    for i in range(3):
        s, length = rand_expr(rng, 3, 5, 9, 3000)
        while length < 300:  # 小さすぎる（1 文字だけなど）ものは引き直す
            s, length = rand_expr(rng, 3, 5, 9, 3000)
        out.append((f"hidden-rand-{i + 1}", "hidden", s + "\n"))
    out.append(("hidden-mid-1", "hidden", wide(rng, 300) + "\n"))
    out.append(("hidden-max-wide", "hidden", wide(rng, 1000) + "\n"))
    out.append(("hidden-max-deep", "hidden", deep(rng, 50, "abc", 45) + "\n"))
    # 最大: 2^5 × 5^5 = 10^5 を 50 段に分けた入れ子で、展開後がちょうど 10^5
    ks = [2, 5] * 5 + [1] * 40
    rng.shuffle(ks)
    s = "z"
    for k in ks:
        s = f"{k}({s})"
    out.append(("hidden-max-exact", "hidden", s + "\n"))
    for name, _, inp in out:
        check_input(name, inp)
    return out


def check_input(name: str, inp: str) -> None:
    """制約（|S| ≤ 1000、入れ子 ≤ 50 段、回数 1〜999・先頭 0 なし、展開後 1〜10^5）を満たすか"""
    s = inp.rstrip("\n")
    assert inp.endswith("\n") and 1 <= len(s) <= 1000 and re.fullmatch(r"[a-z0-9()]+", s), name
    d = 0
    for ch in s:
        d += 1 if ch == "(" else -1 if ch == ")" else 0
        assert 0 <= d <= 50, name
    assert d == 0, name
    for m in re.finditer(r"\d+", s):
        assert m.group()[0] != "0" and int(m.group()) <= 999 and s[m.end()] != ")", name
    assert "()" not in s, name
    assert 1 <= len(solve(inp)) - 1 <= LIMIT, name


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
