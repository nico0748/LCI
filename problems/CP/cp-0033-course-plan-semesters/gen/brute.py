"""cp-0033 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（段ごとの Kahn 法）とは別に、学期ごとに全科目を見直す素直な方法で書く:
「前提科目がすべて前の学期までに修了済み」の未修了科目をすべて取る。取れる科目が無くなったら終わり。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    pre = [set() for _ in range(n + 1)]
    for i in range(m):
        u, v = tok[2 + 2 * i], tok[3 + 2 * i]
        pre[v].add(u)
    done = set()
    counts = []
    while len(done) < n:
        take = [v for v in range(1, n + 1) if v not in done and pre[v] <= done]
        if not take:
            return "-1\n"
        counts.append(len(take))
        done |= set(take)
    return f"{len(counts)}\n{' '.join(map(str, counts))}\n"
