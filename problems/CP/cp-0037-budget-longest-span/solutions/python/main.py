import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, b = int(tok[0]), int(tok[1])
    a = list(map(int, tok[2 : 2 + n]))
    best_len = best_l = 0
    s = 0
    l = 0
    for r in range(n):
        s += a[r]
        while s > b:  # 費用は 0 以上なので、左端を進めると合計は減る（増えない）
            s -= a[l]
            l += 1
        if r - l + 1 > best_len:  # 「>」で更新: 同じ長さなら先に見つかった（早い）開始日を残す
            best_len = r - l + 1
            best_l = l + 1
    print(f"{best_len} {best_l}" if best_len else 0)


main()
