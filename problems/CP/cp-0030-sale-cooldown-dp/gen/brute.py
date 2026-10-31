"""cp-0030 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（DP）とは別の考え方で、買う店の集合をすべて（2^N 通り）試し、どの 2 店も番号の差が D 以上のものの合計の最大を取る。
"""


def brute(inp: str) -> str:
    t = list(map(int, inp.split()))
    n, d = t[0], t[1]
    a = t[2 : 2 + n]
    best = 0
    for mask in range(1 << n):
        chosen = [i for i in range(n) if mask >> i & 1]
        if all(chosen[j + 1] - chosen[j] >= d for j in range(len(chosen) - 1)):
            best = max(best, sum(a[i] for i in chosen))
    return f"{best}\n"
