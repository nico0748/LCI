"""cp-0015 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは比較関数を手で書き（書名は ord で 1 文字ずつ比べる）、挿入ソートで並べる。
"""


def ascii_cmp(a: str, b: str) -> int:
    for x, y in zip(a, b):
        if ord(x) != ord(y):
            return -1 if ord(x) < ord(y) else 1
    return (len(a) > len(b)) - (len(a) < len(b))


def brute(inp: str) -> str:
    tok = inp.split()
    g = int(tok[0])
    order = tok[1 : 1 + g]
    n = int(tok[1 + g])
    books = [(tok[2 + g + 3 * i], tok[3 + g + 3 * i], int(tok[4 + g + 3 * i])) for i in range(n)]

    def cmp(a: tuple[str, str, int], b: tuple[str, str, int]) -> int:
        ia = order.index(a[1]) if a[1] in order else None
        ib = order.index(b[1]) if b[1] in order else None
        if ia is not None and ib is not None and ia != ib:
            return -1 if ia < ib else 1
        if (ia is None) != (ib is None):
            return -1 if ia is not None else 1
        if ia is None and a[1] != b[1]:
            return ascii_cmp(a[1], b[1])
        if a[2] != b[2]:
            return -1 if a[2] > b[2] else 1
        return ascii_cmp(a[0], b[0])

    res: list[tuple[str, str, int]] = []
    for bk in books:
        i = len(res)
        while i > 0 and cmp(res[i - 1], bk) > 0:
            i -= 1
        res.insert(i, bk)
    return "".join(b[0] + "\n" for b in res)
