"""cp-0022 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
来場者ごとに滞在中の秒を 1 秒ずつ塗る（区間の長さの合計に比例。stress の入力は幅 200 秒以内なので速い）。
"""

DAY = 86400


def brute(inp: str) -> str:
    t = list(map(int, inp.split()))
    n = t[0]
    cnt = [0] * DAY
    for i in range(n):
        s, e = t[1 + 2 * i], t[2 + 2 * i]
        for x in range(s, e):  # s 秒以上 e 秒未満
            cnt[x] += 1
    best, first, total = -1, -1, 0
    for x in range(DAY):
        if cnt[x] > best:
            best, first, total = cnt[x], x, 1
        elif cnt[x] == best:
            total += 1
    return f"{best}\n{first}\n{total}\n"
