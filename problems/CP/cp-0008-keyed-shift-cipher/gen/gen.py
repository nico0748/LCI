#!/usr/bin/env python3
"""cp-0008 鍵付きシフト暗号の復号 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0008 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
sys.dont_write_bytecode = True  # gen/__pycache__ を作らない（.gitignore に無いため）
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

PRINTABLE = "".join(chr(c) for c in range(0x20, 0x7F))
LOWER = "abcdefghijklmnopqrstuvwxyz"


def solve(inp: str) -> str:
    """想定解。英字だけを鍵 1 文字ぶん戻し、そのときだけ鍵の位置を進める。結果はリストに溜めて最後に join"""
    lines = inp.split("\n")
    key = [ord(c) - 97 for c in lines[0].strip()]
    s = lines[1]
    m = len(key)
    j = 0
    out = []
    for ch in s:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - 97 - key[j % m]) % 26 + 97))
            j += 1
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 - key[j % m]) % 26 + 65))
            j += 1
        else:
            out.append(ch)
    return "".join(out) + "\n"


def encrypt(key: str, plain: str) -> str:
    """問題文の「暗号化」の定義どおり（英字だけを鍵の文字ぶん進める）。sample と hidden の入力作り用"""
    out, j = [], 0
    for ch in plain:
        if ch.isascii() and ch.isalpha():
            base = 97 if ch.islower() else 65
            out.append(chr((ord(ch) - base + ord(key[j % len(key)]) - 97) % 26 + base))
            j += 1
        else:
            out.append(ch)
    return "".join(out)


def render(key: str, s: str) -> str:
    assert s and s[0] != " " and s[-1] != " "
    return f"{key}\n{s}\n"


def rand_text(rng: SplitMix64, n: int, alphabet: str) -> str:
    while True:
        s = "".join(rng.choice(alphabet) for _ in range(n))
        if s[0] != " " and s[-1] != " ":
            return s


def rand_key(rng: SplitMix64, n: int) -> str:
    return "".join(rng.choice(LOWER) for _ in range(n))


def random_small(rng: SplitMix64) -> str:
    alpha = rng.choice(["aAzZ b.1!", "abcxyz", "ABCxyz  ,", PRINTABLE])
    key = "".join(rng.choice("abyz" if rng.randint(0, 1) else LOWER) for _ in range(rng.randint(1, 4)))
    return render(key, rand_text(rng, rng.randint(1, 20), alpha))


def same(a: str, b: str) -> bool:
    return a == b  # compare: exact


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", render("key", encrypt("key", "Hello, World!"))))
    out.append(("sample-2", "sample", render("lci", encrypt("lci", "Meet at 7 pm, Gate B."))))
    out.append(("sample-3-no-letters", "sample", render("abc", "2026-10-25 12:00")))
    rng = SplitMix64(0x5EED_0008)
    out.append(("hidden-min-1", "hidden", render("a", "a")))
    out.append(("hidden-min-2", "hidden", render("z", "A")))
    # 暗号文が a / A ばかり、鍵が z / y ばかり: (c − k) が必ず負になる
    out.append(("hidden-trap-negative-mod", "hidden", render("zyzzy", "aaaa AAAA aAaA b B")))
    plain = "a1b2c3 d-e-f g.h.i (j) [k] {l} m@n#o$p"
    out.append(("hidden-trap-key-advance", "hidden", render("bcd", encrypt("bcd", plain))))
    out.append(("hidden-trap-key-advance-2", "hidden", render("abcdefghijklmnopqrstuvwxyz", encrypt("abcdefghijklmnopqrstuvwxyz", "x " * 30 + "1,2,3 the END."))))
    out.append(("hidden-trap-uppercase", "hidden", render("secret", encrypt("secret", "The Quick BROWN fox Jumps OVER the lazy DOG"))))
    out.append(("hidden-trap-spaces", "hidden", render("pq", encrypt("pq", "a  b   c    d,  e!     f  ?  ~g"))))
    out.append(("hidden-edge-no-letters-symbols", "hidden", render("q", "\"#$%&'()*+,-./0123456789:;<=>?@ [\\]^_` {|}~")))
    key = rand_key(rng, 1000)
    out.append(("hidden-edge-long-key", "hidden", render(key, encrypt(key, "short text, Long KEY."))))
    for i in range(4):
        key = rand_key(rng, rng.randint(1, 8))
        out.append((f"hidden-rand-{i + 1}", "hidden", render(key, rand_text(rng, rng.randint(20, 80), PRINTABLE))))
    out.append(("hidden-mid-1", "hidden", render(rand_key(rng, 50), rand_text(rng, 5000, PRINTABLE))))
    out.append(("hidden-max-text", "hidden", render(rand_key(rng, 1000), rand_text(rng, 200000, PRINTABLE))))
    out.append(("hidden-max-letters", "hidden", render(rand_key(rng, 7), rand_text(rng, 200000, LOWER + LOWER.upper()))))
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
