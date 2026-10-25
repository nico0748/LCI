"""cp-0010 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（ソート＋二分探索）とは別に、家ごとに全部の駅との距離を測って最小を取る。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, q = tok[0], tok[1]
    xs = tok[2 : 2 + n]
    hs = tok[2 + n : 2 + n + q]
    return "\n".join(str(min(abs(x - h) for x in xs)) for h in hs) + "\n"
