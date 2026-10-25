import sys
from itertools import accumulate


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    q = int(tok[0])
    nums = list(map(int, tok[1 : 1 + 2 * q]))
    n = max(nums[1::2])  # 篩は R の最大値までで足りる（最大 10^6）
    # エラトステネスの篩: is_p[x] = 1 なら素数。0 と 1 は素数でない
    is_p = bytearray([1]) * (n + 1)
    is_p[0] = 0
    if n >= 1:
        is_p[1] = 0
    i = 2
    while i * i <= n:
        if is_p[i]:
            is_p[i * i :: i] = bytes(len(range(i * i, n + 1, i)))  # i の倍数をまとめて消す（スライス代入は C の速さ）
        i += 1
    # pre[x] = 1..x の素数の個数（pre[0] = 0）。[L, R] の個数は pre[R] - pre[L - 1]
    pre = list(accumulate(is_p))
    pre[0] = 0
    out = [pre[nums[2 * k + 1]] - pre[nums[2 * k] - 1] for k in range(q)]
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
