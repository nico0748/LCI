import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, m = int(tok[0]), int(tok[1])
    # 余りごとの個数を辞書で数える（M は最大 10^9 なので大きさ M の配列は取れない）
    cnt: dict[int, int] = {}
    ans = 0
    for i in range(2, 2 + n):
        r = int(tok[i]) % m
        # 左から見て「それまでに見た、余り (M − r) mod M の袋」と組む。r = 0 や r = M/2 も同じ式で数えられる
        ans += cnt.get((m - r) % m, 0)
        cnt[r] = cnt.get(r, 0) + 1
    print(ans)


main()
