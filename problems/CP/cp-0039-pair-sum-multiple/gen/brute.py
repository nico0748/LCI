"""cp-0039 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

すべての組 i < j について (A_i + A_j) mod M を直接調べる O(N^2)。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, m = tok[0], tok[1]
    a = tok[2 : 2 + n]
    ans = 0
    for i in range(n):
        for j in range(i + 1, n):
            if (a[i] + a[j]) % m == 0:
                ans += 1
    return f"{ans}\n"
