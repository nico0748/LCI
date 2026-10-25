"""cp-0020 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは 2^N 通りの予約の選び方をすべて試し、開始時刻の順に並べて「次の開始 ≥ 前の終了 + C」を確かめる。
"""


def brute(inp: str) -> str:
    tok = inp.split()
    n, c = int(tok[0]), int(tok[1])
    bk = [(int(tok[2 + 2 * i]), int(tok[3 + 2 * i])) for i in range(n)]
    best = 0
    for mask in range(1 << n):
        pick = sorted(bk[i] for i in range(n) if mask >> i & 1)
        if all(pick[j + 1][0] >= pick[j][1] + c for j in range(len(pick) - 1)):
            best = max(best, len(pick))
    return f"{best}\n"
