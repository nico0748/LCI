# 素朴解（TLE させたい解）: K×K 区画ごとに K^2 マスを足し直す O((H−K+1)(W−K+1)K^2)。
# hidden-max-k500（1000×1000、K=500）で 501^2 × 500^2 ≈ 6.3×10^10 回になり、selftest --naive で TLE を確かめる
import sys


def main() -> None:
    lines = sys.stdin.read().split("\n")
    h, w, k = map(int, lines[0].split())
    g = [[ord(ch) - 48 for ch in lines[1 + i]] for i in range(h)]
    best, br, bc = -1, 0, 0
    for r in range(h - k + 1):
        for c in range(w - k + 1):
            s = 0
            for dr in range(k):
                row = g[r + dr]
                for dc in range(k):
                    s += row[c + dc]
            if s > best:
                best, br, bc = s, r, c
    print(best)
    print(br + 1, bc + 1)


main()
