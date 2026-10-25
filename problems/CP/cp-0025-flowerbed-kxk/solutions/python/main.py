import sys
from itertools import accumulate


def main() -> None:
    data = sys.stdin.buffer.read().split()
    h, w, k = int(data[0]), int(data[1]), int(data[2])
    # S[i][j] = 上 i 行・左 j 列の花の合計（先頭に 0 の行・列を付けた (H+1)×(W+1)）
    prev = [0] * (w + 1)
    S = [prev]
    for i in range(h):
        row = data[3 + i]  # bytes。各要素は文字コード（'0' = 48）
        rowacc = accumulate((b - 48 for b in row), initial=0)
        prev = [a + b for a, b in zip(prev, rowacc)]
        S.append(prev)
    best, br, bc = -1, 0, 0
    span = w - k + 1
    for r in range(h - k + 1):
        top, bot = S[r], S[r + k]
        # 区画 (r, c) の合計 = bot[c+k] - top[c+k] - bot[c] + top[c]
        sums = [bot[c + k] - top[c + k] - bot[c] + top[c] for c in range(span)]
        m = max(sums)
        if m > best:  # 上の行を優先: 同点なら更新しない
            best, br, bc = m, r, sums.index(m)  # index は最初（最も左）の位置
    sys.stdout.write(f"{best}\n{br + 1} {bc + 1}\n")


main()
