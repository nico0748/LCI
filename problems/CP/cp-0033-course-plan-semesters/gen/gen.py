#!/usr/bin/env python3
"""cp-0033 履修計画の最短学期数 のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0033 --naive` で hidden-max-* のどれかが TLE することを確かめる
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
    """想定解: 段ごとの Kahn 法。入次数 0 の科目を 1 学期目とし、その学期の科目を取り除いて次の段を作る"""
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    adj = [[] for _ in range(n + 1)]
    indeg = [0] * (n + 1)
    for i in range(m):
        u, v = tok[2 + 2 * i], tok[3 + 2 * i]
        adj[u].append(v)  # 重複した辺もそのまま数える（入次数も同じ回数だけ減るので整合する）
        indeg[v] += 1
    cur = [v for v in range(1, n + 1) if indeg[v] == 0]
    counts = []
    done = 0
    while cur:
        counts.append(len(cur))
        done += len(cur)
        nxt = []
        for u in cur:
            for v in adj[u]:
                indeg[v] -= 1
                if indeg[v] == 0:
                    nxt.append(v)
        cur = nxt
    if done < n:
        return "-1\n"
    return f"{len(counts)}\n{' '.join(map(str, counts))}\n"


def render(n: int, edges: list[tuple[int, int]]) -> str:
    return f"{n} {len(edges)}\n" + "".join(f"{u} {v}\n" for u, v in edges)


def random_dag(rng: SplitMix64, n: int, m: int, levels: int) -> list[tuple[int, int]]:
    """科目に段（0..levels-1）を割り振り、低い段 → 高い段の辺だけを張る（ラベルはシャッフル）"""
    perm = list(range(1, n + 1))
    rng.shuffle(perm)
    lev = [rng.randint(0, levels - 1) for _ in range(n)]
    by = {}
    for i, l in enumerate(lev):
        by.setdefault(l, []).append(perm[i])
    keys = sorted(by)
    edges = []
    if len(keys) < 2:
        return edges
    for _ in range(m):
        a = rng.randint(0, len(keys) - 2)
        b = rng.randint(a + 1, min(len(keys) - 1, a + 3))
        edges.append((rng.choice(by[keys[a]]), rng.choice(by[keys[b]])))
    return edges


def backbone_dag(rng: SplitMix64, n: int, m: int, levels: int) -> list[tuple[int, int]]:
    """段 0..levels-1 の各段に 1 科目ずつ背骨の鎖を通し（最短学期数がちょうど levels になる）、
    残りの辺は低い段 → 高い段へランダムに張る（一部は重複させる）。ラベルはシャッフル"""
    perm = list(range(1, n + 1))
    rng.shuffle(perm)
    spine = perm[:levels]
    lev = {v: i for i, v in enumerate(spine)}
    for v in perm[levels:]:
        lev[v] = rng.randint(0, levels - 1)
    by = [[] for _ in range(levels)]
    for v in perm:
        by[lev[v]].append(v)
    edges = [(spine[i], spine[i + 1]) for i in range(levels - 1)]
    while len(edges) < m:
        if len(edges) > levels and rng.randint(0, 19) == 0:
            edges.append(edges[rng.randint(0, len(edges) - 1)])  # 重複した前提関係
            continue
        a = rng.randint(0, levels - 2)
        b = rng.randint(a + 1, min(levels - 1, a + 5))
        edges.append((rng.choice(by[a]), rng.choice(by[b])))
    rng.shuffle(edges)
    return edges


def random_small(rng: SplitMix64) -> str:
    """科目 1〜8・辺 0〜12。辺はランダム（閉路も重複も自然に混ざる）。半分は DAG にする"""
    n = rng.randint(1, 8)
    m = rng.randint(0, 12) if n > 1 else 0
    if rng.randint(0, 1):
        edges = []
        for _ in range(m):
            u = rng.randint(1, n)
            v = rng.randint(1, n)
            while v == u:
                v = rng.randint(1, n)
            edges.append((u, v))
    else:
        edges = random_dag(rng, n, m, rng.randint(1, n))
    return render(n, edges)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def chain(rng: SplitMix64, n: int) -> list[tuple[int, int]]:
    perm = list(range(1, n + 1))
    rng.shuffle(perm)
    edges = [(perm[i], perm[i + 1]) for i in range(n - 1)]
    rng.shuffle(edges)
    return edges


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "5 4\n1 2\n1 3\n3 4\n2 4\n"))
    out.append(("sample-2-cycle", "sample", "3 3\n1 2\n2 3\n3 1\n"))
    rng = SplitMix64(0x5EED_0033)
    out.append(("hidden-min-1", "hidden", "1 0\n"))
    out.append(("hidden-trap-no-edges", "hidden", "6 0\n"))
    # 同じ前提関係の重複: 隣接を set にして入次数は重複込みで数える、などの不整合で -1 と誤判定する
    out.append(("hidden-trap-duplicate-edges", "hidden", render(5, [(1, 2), (1, 2), (2, 3), (1, 2), (3, 5), (2, 3), (4, 5), (4, 5), (1, 3)])))
    # 2 科目の循環（u→v と v→u）と、DAG の一部にだけある閉路（処理できた分だけで学期数を答えると WA）
    out.append(("hidden-trap-two-cycle", "hidden", render(4, [(1, 2), (3, 4), (4, 3)])))
    out.append(("hidden-trap-partial-cycle", "hidden", render(8, [(1, 2), (2, 3), (3, 4), (5, 6), (6, 7), (7, 5), (4, 8), (1, 8)])))
    out.append(("hidden-edge-star", "hidden", render(7, [(4, v) for v in (1, 2, 3, 5, 6, 7)])))
    # 再帰の深さ: 10^5 科目が 1 本の鎖（ラベルはシャッフル）。再帰 DFS は Python/Node で落ちる
    n = 100000
    out.append(("hidden-trap-deep-chain", "hidden", render(n, chain(rng, n))))
    for i in range(3):
        nn = rng.randint(5, 30)
        out.append((f"hidden-rand-{i + 1}", "hidden", render(nn, random_dag(rng, nn, rng.randint(0, 60), rng.randint(1, 10)))))
    out.append(("hidden-mid-1", "hidden", render(2000, backbone_dag(rng, 2000, 3000, 80))))
    # 最大: 最短 3000 学期の DAG、辺 10^5（重複を含む）。毎学期すべての科目を見直す素朴解は O(S×(N+M)) ≈ 6×10^8 で TLE
    out.append(("hidden-max-layered-dag", "hidden", render(n, backbone_dag(rng, n, 100000, 3000))))
    # 最大: 99999 科目の鎖の最後に閉路（終盤まで進んでから -1 と分かる）
    perm = list(range(1, n + 1))
    rng.shuffle(perm)
    edges = [(perm[i], perm[i + 1]) for i in range(n - 1)] + [(perm[n - 1], perm[n - 3])]
    rng.shuffle(edges)
    out.append(("hidden-max-cycle-at-end", "hidden", render(n, edges)))
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
