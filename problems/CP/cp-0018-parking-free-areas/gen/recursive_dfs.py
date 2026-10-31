"""cp-0018 の再帰 DFS 版（罠の確認用。selftest の --naive の対象外）。

再帰の深さ = 塗る順につながった経路の長さ。hidden-max-serpentine（1 本道 500,500 マス）や
hidden-max-all-free（DFS の木の深さ約 10^6）で、再帰上限・スタック・メモリのどれかに当たって落ちることを確かめる。
TLE ではなく異常終了（RecursionError / メモリ不足）で落ちるため、naive.py という名前にはしていない
（selftest --naive は「hidden-max-* のどれかで TLE」を要求する）。

実測（このコンテナ、Python 3.13、ulimit -v 512MB = judge と同じ memoryMb 256 × 2）:
  - setrecursionlimit を上げない: hidden-mid-spiral（深さ約 1.2 万）以上で RecursionError
  - setrecursionlimit(10**7): hidden-max-serpentine は通る（約 0.9 秒）、hidden-max-all-free はメモリが尽きて異常終了
  使い方: python3 gen/recursive_dfs.py < tests/23.in（23 = hidden-max-all-free、22 = hidden-max-serpentine）
"""
import sys

sys.setrecursionlimit(10**7)


def main() -> None:
    data = sys.stdin.read().split("\n")
    h, w = map(int, data[0].split())
    g = [list(data[1 + r]) for r in range(h)]

    def dfs(r: int, c: int) -> int:
        g[r][c] = "#"
        n = 1
        for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if 0 <= nr < h and 0 <= nc < w and g[nr][nc] == ".":
                n += dfs(nr, nc)
        return n

    cnt = best = 0
    for r in range(h):
        for c in range(w):
            if g[r][c] == ".":
                cnt += 1
                best = max(best, dfs(r, c))
    print(cnt, best)


main()
