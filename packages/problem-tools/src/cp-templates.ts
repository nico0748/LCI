/**
 * CP（競技プログラミング形式）の雛形。`new CP ...` が書き出す（05_cp_problems.md §4）。
 *
 * - starter は 6 言語共通のテンプレート: 「標準入力をまとめて速く読む」＋「出力はまとめて書く」の枠と TODO だけ。
 *   問題固有の入力解析は書かない（paiza C/B では入力の解析も練習の一部、05 §4.4）。何も出力しないので
 *   selftest の starter 検査（starter がテストを落とすこと）は必ず FAILS になる。
 * - gen/gen.py は決定的な生成器の骨組み。自前の PRNG（SplitMix64）・ケース番号の採番・tests.json の書き換え・
 *   `--check`（再生成との完全一致と brute との突合）までを持ち、問題ごとに solve / brute / cases を埋める。
 */

/** CP は全問この 6 言語（05 §2.1） */
export const CP_LANGUAGES = ["c", "rust", "python", "go", "typescript", "php"] as const;
export type CpLanguage = (typeof CP_LANGUAGES)[number];

/** 言語ごとのファイル名。runner の DEFAULT_ENTRY と同じ（Run/判定の entry 推定が素直に当たるようにする） */
export const CP_FILE: Record<CpLanguage, string> = {
  c: "main.c",
  rust: "main.rs",
  python: "main.py",
  go: "main.go",
  typescript: "main.ts",
  php: "main.php",
};

export const CP_STARTER: Record<CpLanguage, string> = {
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 標準入力をまとめて読む（NUL 終端。*len に長さ）。scanf を何度も呼ぶより速い */
static char *read_all(size_t *len) {
    size_t cap = 1 << 16, n = 0, r;
    char *buf = malloc(cap);
    while ((r = fread(buf + n, 1, cap - n - 1, stdin)) > 0) {
        n += r;
        if (n + 1 == cap) {
            cap *= 2;
            buf = realloc(buf, cap);
        }
    }
    buf[n] = '\\0';
    *len = n;
    return buf;
}

int main(void) {
    size_t len;
    char *input = read_all(&len);
    /* 例: char *p = input; long long n = strtoll(p, &p, 10);  （空白を含む行は strchr(p, '\\n') で区切る） */
    /* TODO: 入力を解析して答えを求め、printf で出力する（最後に改行を付ける。和は long long） */
    free(input);
    return 0;
}
`,
  rust: `use std::io::{self, BufWriter, Read, Write};

fn main() {
    // 標準入力をまとめて読む（read_line を繰り返すより速い）
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // 出力は BufWriter に溜めて最後に flush する
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    // 例: let mut it = input.split_ascii_whitespace();
    //     let n: usize = it.next().unwrap().parse().unwrap();
    //     行ごとに読むなら input.lines()
    // TODO: 入力を解析して答えを求め、writeln!(out, "{}", ans).unwrap(); で出力する
    out.flush().unwrap();
}
`,
  python: `import sys


def main() -> None:
    # 標準入力をまとめて読む（input() を何度も呼ぶより速い）
    data = sys.stdin.read()
    # 例: tokens = data.split()  /  lines = data.split("\\n")（空白を含む行はこちら）
    # TODO: 入力を解析して答えを求める
    # 出力はまとめて 1 回で書く（例: sys.stdout.write("\\n".join(map(str, ans)) + "\\n")）
    del data


main()
`,
  go: `package main

import (
	"bufio"
	"io"
	"os"
)

func main() {
	// 標準入力をまとめて読む。出力は bufio.Writer に溜め、最後に Flush する（defer で必ず書き出す）
	data, _ := io.ReadAll(bufio.NewReader(os.Stdin))
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()
	// 例: fields := strings.Fields(string(data)); n, _ := strconv.Atoi(fields[0])
	// TODO: 入力を解析して答えを求め、fmt.Fprintln(out, ans) で出力する（和は int64）
	_ = data
}
`,
  typescript: `import { readFileSync } from "node:fs";

// 標準入力をまとめて読む（readline で 1 行ずつ読むより速い）
const input = readFileSync(0, "utf8");
// 例: const tokens = input.split(/\\s+/).filter((s) => s !== "");  /  const lines = input.split("\\n");
// TODO: 入力を解析して答えを求める（2^53 を超える整数は BigInt、数値の sort は比較関数を渡す）
// 出力は配列に溜めて最後に 1 回で書く（例: process.stdout.write(out.join("\\n") + "\\n")）
void input;
`,
  php: `<?php
// 標準入力をまとめて読む（fgets を何度も呼ぶより速い）
$input = stream_get_contents(STDIN);
// 例: $tokens = preg_split('/\\s+/', trim($input));  /  $lines = explode("\\n", $input);
// TODO: 入力を解析して答えを求める
// 出力は配列に溜めて最後に 1 回で echo する（例: echo implode("\\n", $out), "\\n";）
unset($input);
`,
};

/** 参照解の置き場の初期内容（starter と同じ枠の先頭に「参照解」の TODO を付けたもの。G1b の「空ファイルでない」を満たす） */
export function cpSolutionPlaceholder(lang: CpLanguage): string {
  const todo = "TODO: 参照解。starter を土台に書く（標準ライブラリのみ、主要ロジックは 80 行以内が目安）";
  switch (lang) {
    case "c":
      return `/* ${todo} */\n` + CP_STARTER.c;
    case "python":
      return `# ${todo}\n` + CP_STARTER.python;
    case "php":
      return CP_STARTER.php.replace("<?php\n", `<?php\n// ${todo}\n`);
    default:
      return `// ${todo}\n` + CP_STARTER[lang];
  }
}

export function cpGenPy(id: string, title: string): string {
  return `#!/usr/bin/env python3
"""${id} ${title} のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  \`pnpm problems:selftest --only ${id} --naive\` で hidden-max-* のどれかが TLE することを確かめる
- サイズ上限: .in 2.5MB・.out 1MB・tests/ 合計 6MB（L1 は 200KB）。\`pnpm problems:validate\` も検査する
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
    """想定解。入力の文字列から期待出力（末尾の改行を含む）を返す"""
    raise NotImplementedError("TODO: 想定解を書く")


def random_small(rng: SplitMix64) -> str:
    """stress 用の小さい入力（brute がすぐ終わる大きさ。境界の値が出やすいよう範囲を狭く取る）"""
    raise NotImplementedError("TODO: 小さいランダム入力を作る")


def same(a: str, b: str) -> bool:
    """stress の比較。既定は空白区切りのトークン一致（tests.json の compare.mode に合わせて変える）"""
    return a.split() == b.split()


def cases() -> list[tuple[str, str, str]]:
    """(name, visibility, stdin) の列。sample は 01 から、hidden は 11 から、この順に番号を振る"""
    out: list[tuple[str, str, str]] = []
    # sample: 問題文の「入力例」をそのまま書く（validate が問題文との一致を検査する）
    out.append(("sample-1", "sample", "TODO\\n"))
    out.append(("sample-2", "sample", "TODO\\n"))
    rng = SplitMix64(0x5EED_0001)
    # hidden: 最小・特殊 → 罠ごとに 1 件以上 → ランダム小（brute と突合済み）→ 中 → 最大（素朴解に最悪の形）
    # out.append(("hidden-min-1", "hidden", "1\\n1\\n"))
    # out.append(("hidden-trap-overflow", "hidden", ...))
    # for i in range(3):
    #     out.append((f"hidden-rand-{i + 1}", "hidden", random_small(rng)))
    # out.append(("hidden-max-chain", "hidden", ...))
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
    return "\\n".join(lines) + "\\n"


def stale_files(files: dict[str, str]) -> list[str]:
    """tests/ にあるが今回は作らない NN.in / NN.out（ケースを減らしたときの消し忘れ）"""
    d = ROOT / "tests"
    if not d.is_dir():
        return []
    return sorted(f"tests/{p.name}" for p in d.iterdir() if re.fullmatch(r"\\d+\\.(in|out)", p.name) and f"tests/{p.name}" not in files)


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
            p.write_text(content, encoding="utf-8", newline="\\n")
        for rel in stale_files(files):
            (ROOT / rel).unlink()
            print(f"削除: {rel}")
        TESTS_JSON.write_text(tests_json, encoding="utf-8", newline="\\n")
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
            ng.append(f"stress {i + 1}: solve と brute が不一致\\n--- 入力\\n{inp}--- brute\\n{want}--- solve\\n{got}")
            break
    for m in ng:
        print("NG", m)
    print(f"{'OK' if not ng else 'NG'}: {len(entries)} ケース、stress {STRESS} 件。{size_report(files)}")
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())
`;
}

export function cpBrutePy(id: string): string {
  return `"""${id} の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
"""


def brute(inp: str) -> str:
    raise NotImplementedError("TODO: 全探索を書く")
`;
}
