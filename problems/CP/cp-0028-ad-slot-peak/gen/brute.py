"""cp-0028 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（イベントの整列）とは別の考え方で、0 から最大の終了時刻までのすべての整数時刻 x について、
掲載中（s ≤ x < t）の広告の単価を直接足す。stress の入力は時刻が 30 以下なので速い。
"""


def brute(inp: str) -> str:
    t = list(map(int, inp.split()))
    n = t[0]
    ads = [(t[1 + 3 * i], t[2 + 3 * i], t[3 + 3 * i]) for i in range(n)]
    best, at = -1, -1
    for x in range(max(e for _, e, _ in ads) + 1):
        f = sum(c for s, e, c in ads if s <= x < e)
        if f > best:
            best, at = f, x
    return f"{best} {at}\n"
