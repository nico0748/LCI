"""cp-0037 の素朴解（TLE させる想定）: 開始日 l ごとに、予算を超えるまで右へ足していく O(N^2)。
全日程が予算内（hidden-max-all-fit）だと毎回末尾まで足すので N^2/2 = 2×10^10 回。"""
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, b = int(tok[0]), int(tok[1])
    a = list(map(int, tok[2 : 2 + n]))
    best_len = best_l = 0
    for l in range(n):
        s = 0
        for r in range(l, n):
            s += a[r]
            if s > b:
                break
            if r - l + 1 > best_len:
                best_len, best_l = r - l + 1, l + 1
    print(f"{best_len} {best_l}" if best_len else 0)


main()
