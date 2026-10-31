"""cp-0039 の素朴解（TLE させる想定）: すべての組 i < j を調べる O(N^2)。N = 2×10^5 では 2×10^10 組。"""
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, m = int(tok[0]), int(tok[1])
    a = [int(x) for x in tok[2 : 2 + n]]
    ans = 0
    for i in range(n):
        ai = a[i]
        for j in range(i + 1, n):
            if (ai + a[j]) % m == 0:
                ans += 1
    print(ans)


main()
