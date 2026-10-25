"""cp-0021 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
- 参加者ごとにログ全体を見直して「押した地点」の表を作る（集合も辞書も使わない）
- 並べ替えは使わず、「まだ選んでいない中で最上位の人」を 3 回選ぶ
- 名前の比較も 1 文字ずつ自前で行う（短い方が先）
"""


def name_less(a: str, b: str) -> bool:
    for x, y in zip(a, b):
        if x != y:
            return ord(x) < ord(y)
    return len(a) < len(b)


def brute(inp: str) -> str:
    t = inp.split()
    n, m = int(t[0]), int(t[1])
    p = [int(x) for x in t[2 : 2 + m]]
    logs = [(t[2 + m + 2 * i], int(t[3 + m + 2 * i])) for i in range(n)]
    names: list[str] = []
    for s, _ in logs:
        if s not in names:
            names.append(s)
    totals: list[tuple[str, int]] = []
    for s in names:
        got = [False] * (m + 1)
        for s2, c in logs:
            if s2 == s:
                got[c] = True
        totals.append((s, sum(p[c - 1] for c in range(1, m + 1) if got[c])))
    out = []
    for _ in range(min(3, len(totals))):
        best = totals[0]
        for e in totals[1:]:
            if e[1] > best[1] or (e[1] == best[1] and name_less(e[0], best[0])):
                best = e
        totals.remove(best)
        out.append(f"{best[0]} {best[1]}\n")
    return "".join(out)
