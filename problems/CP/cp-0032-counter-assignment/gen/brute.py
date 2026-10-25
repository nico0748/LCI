"""cp-0032 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（客ごとに案内時刻を式で求める）とは別に、時刻を 1 ずつ進める素直なシミュレーションで書く。
各時刻 t で (1) 手続きが t までに終わった窓口を空きにする (2) t までに着いた客を列に入れる
(3) 列の先頭から、空いている窓口のうち番号最小へ順に案内する。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    cust = [(tok[2 + 2 * i], tok[3 + 2 * i]) for i in range(n)]
    end = [None] * m  # 手続き中なら終了時刻、空きなら None
    res = [None] * n
    nxt = 0  # 次に列へ入る客
    queue = []
    t = 0
    done = 0
    while done < n:
        for k in range(m):
            if end[k] is not None and end[k] <= t:
                end[k] = None
        while nxt < n and cust[nxt][0] <= t:
            queue.append(nxt)
            nxt += 1
        while queue:
            idle = [k for k in range(m) if end[k] is None]
            if not idle:
                break
            i = queue.pop(0)
            k = idle[0]
            end[k] = t + cust[i][1]
            res[i] = (k + 1, t - cust[i][0])
            done += 1
        t += 1
    return "".join(f"{k} {w}\n" for k, w in res)
