"""cp-0019 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここではクエリごとに L〜R の各数を試し割り（2〜√x で割り切れるか）で判定して数える。
"""


def is_prime(x: int) -> bool:
    if x < 2:
        return False
    d = 2
    while d * d <= x:
        if x % d == 0:
            return False
        d += 1
    return True


def brute(inp: str) -> str:
    tok = inp.split()
    q = int(tok[0])
    out = []
    for i in range(q):
        lo, hi = int(tok[1 + 2 * i]), int(tok[2 + 2 * i])
        out.append(sum(1 for x in range(lo, hi + 1) if is_prime(x)))
    return "\n".join(map(str, out)) + "\n"
