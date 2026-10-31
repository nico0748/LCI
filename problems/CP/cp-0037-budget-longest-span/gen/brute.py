"""cp-0037 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

すべての (l, r) について合計を直接足して調べる O(N^3)。長さの長い順・開始日の早い順に見て、最初に予算内のものが答え。
"""


def brute(inp: str) -> str:
    tok = list(map(int, inp.split()))
    n, b = tok[0], tok[1]
    a = tok[2 : 2 + n]
    for length in range(n, 0, -1):
        for l in range(0, n - length + 1):
            if sum(a[l : l + length]) <= b:
                return f"{length} {l + 1}\n"
    return "0\n"
