#!/usr/bin/env python3
"""cp-0026 道路網と配達の締め切り のテスト生成（決定的）。

  python3 gen/gen.py          tests/*.in・*.out と tests.json の cases を書き直す
  python3 gen/gen.py --check  何も書かずに、(1) 再生成した結果が tests/ と tests.json に完全一致するか、
                              (2) 小さいランダム入力 STRESS 件で solve() と brute() が一致するか、を検査する（不一致なら exit 1）

規約（docs/requirements/05_cp_problems.md §4）:
- 乱数は下の SplitMix64 だけを使う。random モジュールは randint/choice/shuffle の列が Python の版をまたいで保証されない
- 01〜03 = sample（問題文の入出力例と 1 文字も違わない）、11〜 = hidden。hidden は 10 件以上、hidden-max-* を 2 件以上
  命名: sample-* / hidden-min-* / hidden-edge-* / hidden-trap-<罠の名前> / hidden-rand-* / hidden-mid-* / hidden-max-*
- 期待出力は solve()（想定解の Python 版）で計算する。.out も commit する（計算方法が変わったら diff で気づける）
- 計算量の罠がある問題は gen/naive.py（C でも落としたいなら naive.c）を置き、
  `pnpm problems:selftest --only cp-0026 --naive` で hidden-max-* のどれかが TLE することを確かめる
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


import heapq

INF = float("inf")


def parse(inp: str):
    t = list(map(int, inp.split()))
    n, m, T = t[0], t[1], t[2]
    edges = [(t[3 + 3 * j], t[4 + 3 * j], t[5 + 3 * j]) for j in range(m)]
    return n, T, edges


def dijkstra(n: int, edges: list[tuple[int, int, int]]) -> list[float]:
    """二分ヒープの Dijkstra。取り出した距離が記録より大きい古い要素は捨てる"""
    adj: list[list[tuple[int, int]]] = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    dist = [INF] * (n + 1)
    dist[1] = 0
    pq = [(0, 1)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist


def solve(inp: str) -> str:
    """想定解。拠点 1 からの最短時間を Dijkstra で求め、T 以下の拠点を数える"""
    n, T, edges = parse(inp)
    dist = dijkstra(n, edges)
    within = sum(1 for d in dist[1:] if d <= T)
    return f"{within}\n{dist[n] if dist[n] != INF else -1}\n"


def median_deadline(n: int, edges: list[tuple[int, int, int]]) -> int:
    """届く拠点の最短時間の中央値（締め切りで半分ほどに分かれるようにする）"""
    ds = sorted(d for d in dijkstra(n, edges)[1:] if d != INF)
    return int(ds[len(ds) // 2])


def fmt(n: int, T: int, edges: list[tuple[int, int, int]]) -> str:
    return f"{n} {len(edges)} {T}\n" + "".join(f"{u} {v} {w}\n" for u, v, w in edges)


def random_graph(rng: SplitMix64, n: int, m: int, wmax: int, connected: bool = True) -> list[tuple[int, int, int]]:
    """connected なら頂点番号をランダムに並べた木（n−1 本）を先に作り、残りを任意の辺で埋める"""
    edges = []
    if connected:
        order = list(range(1, n + 1))
        rng.shuffle(order)
        for i in range(1, n):
            edges.append((order[i], order[rng.randint(max(0, i - 50), i - 1)], rng.randint(1, wmax)))
    while len(edges) < m:
        u, v = rng.randint(1, n), rng.randint(1, n)
        if u != v:
            edges.append((u, v, rng.randint(1, wmax)))
    rng.shuffle(edges)
    return edges[:m]


def random_small(rng: SplitMix64) -> str:
    n = rng.randint(2, 7)
    m = rng.randint(0, 10)
    edges = random_graph(rng, n, m, rng.choice([1, 3, 10]), connected=bool(rng.randint(0, 1)) and m >= n - 1)
    return fmt(n, rng.randint(0, 12), edges)


def same(a: str, b: str) -> bool:
    return a.split() == b.split()


def stale_hub(k: int) -> str:
    """古いヒープ要素を捨てないと遅くなる形。1 — m_i（重み i）、m_i — 拠点 N（重み 2k+1−2i）。
    m_i を確定するたびに拠点 N の距離が 1 ずつ縮んで k 回 push され、古い k−1 個を取り出すたびに
    拠点 N の k 本の辺を見直すと k^2 回（k = 5×10^4 で 2.5×10^9）になる"""
    n = k + 2
    edges = []
    for i in range(1, k + 1):
        edges.append((1, 1 + i, i))
        edges.append((1 + i, n, 2 * k + 1 - 2 * i))
    return fmt(n, k + 1, edges)


def cases() -> list[tuple[str, str, str]]:
    out: list[tuple[str, str, str]] = []
    out.append(("sample-1", "sample", "5 6 10\n1 2 4\n1 3 1\n3 2 2\n2 4 5\n3 4 9\n4 5 3\n"))
    out.append(("sample-2-unreachable", "sample", "4 2 5\n1 2 5\n3 4 1\n"))
    out.append(("sample-3-fewer-roads", "sample", "3 3 100\n1 3 100\n1 2 1\n2 3 1\n"))
    rng = SplitMix64(0x5EED_0026)

    out.append(("hidden-min-1", "hidden", "2 0 0\n"))
    out.append(("hidden-edge-t0", "hidden", fmt(6, 0, random_graph(rng, 6, 9, 5))))
    # 本数が少ない経路ほど遅い（重みを無視した BFS は WA）
    edges = [(1, 1000, 10**6)]
    for i in range(1, 999):
        edges.append((i, i + 1, 1))
    edges.append((999, 1000, 1))
    edges += [(1, rng.randint(2, 999), 10**6) for _ in range(200)]
    rng.shuffle(edges)
    out.append(("hidden-trap-bfs-weights", "hidden", fmt(1000, 600, edges)))
    # 距離が 2^31 を超える（鎖 3000 本 × 10^6）
    order = [1] + sorted(range(2, 3001), key=lambda _: rng.next_u64())
    order.remove(3000)
    order.append(3000)
    edges = [(order[i], order[i + 1], 10**6) for i in range(2999)]
    out.append(("hidden-trap-int64", "hidden", fmt(3000, 2_500_000_000, edges)))
    # 拠点 N には届かないが、他の拠点は多く届く
    edges = random_graph(rng, 499, 2000, 1000)
    out.append(("hidden-trap-unreachable", "hidden", fmt(500, median_deadline(500, edges), edges)))
    # 同じ 2 拠点を結ぶ道路が複数（最後に読んだ辺で上書きすると WA）
    edges = []
    for i in range(1, 200):
        ws = [rng.randint(1, 1000) for _ in range(3)]
        for w in sorted(ws, reverse=True):
            edges.append((i, i + 1, w))
    out.append(("hidden-trap-multi-edge", "hidden", fmt(200, 50000, edges)))
    # 古い要素を捨てないと 10^8 回（Python/PHP は TLE）。同じ形の最大は hidden-max-stale-hub
    out.append(("hidden-trap-stale-heap", "hidden", stale_hub(10000)))
    for i in range(3):
        n = rng.randint(5, 40)
        edges = random_graph(rng, n, rng.randint(n - 1, 3 * n), 20, connected=bool(i % 2 == 0))
        out.append((f"hidden-rand-{i + 1}", "hidden", fmt(n, rng.randint(0, 100), edges)))
    edges = random_graph(rng, 5000, 10000, 10**4)
    out.append(("hidden-mid-1", "hidden", fmt(5000, median_deadline(5000, edges), edges)))
    # 最大: N = 10^5 の連結グラフ（ほぼ木）。O(N^2) の Dijkstra（配列から最小を探す）は 10^10 回
    edges = random_graph(rng, 100000, 100000, 10**4)
    out.append(("hidden-max-sparse", "hidden", fmt(100000, median_deadline(100000, edges), edges)))
    # 最大: 鎖（番号はばらばら、拠点 N が末端）で距離は約 10^11
    order = [1] + sorted(range(2, 100000), key=lambda _: rng.next_u64()) + [100000]
    edges = [(order[i], order[i + 1], 10**6 - rng.randint(0, 9)) for i in range(99999)]
    rng.shuffle(edges)
    out.append(("hidden-max-chain", "hidden", fmt(100000, 5 * 10**10, edges)))
    # 最大: 古いヒープ要素を捨てない実装が 2.5×10^9 回になる形（k = 5×10^4、M = 10^5）
    out.append(("hidden-max-stale-hub", "hidden", stale_hub(50000)))
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
