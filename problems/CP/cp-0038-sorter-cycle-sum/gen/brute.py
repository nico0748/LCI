"""cp-0038 の全探索（小さい入力専用、K ≤ 数十）。gen.py の stress から呼ばれる。

K 回の移動をそのままシミュレーションする。
"""

MOD = 10 ** 9 + 7


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, k = tok[0], tok[1]
    t = [0] + tok[2 : 2 + n]
    a = [0] + tok[2 + n : 2 + 2 * n]
    x = 1
    total = 0
    for _ in range(k):
        total += a[x]
        x = t[x]
    return f"{x} {total % MOD}\n"
