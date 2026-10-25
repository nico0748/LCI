import sys


def is_leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def days_in(y: int, m: int) -> int:
    if m == 2:
        return 29 if is_leap(y) else 28
    return 30 if m in (4, 6, 9, 11) else 31


def main() -> None:
    data = sys.stdin.read().split()
    q = int(data[0])
    out = []
    for i in range(q):
        s, k = data[1 + 2 * i], int(data[2 + 2 * i])
        y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
        idx = y * 12 + (m - 1) + k  # 月の通し番号（0 始まり）で k か月進める
        ty, tm = divmod(idx, 12)
        tm += 1
        last = days_in(ty, tm)
        if d > last:  # 同じ日が無い → その月の末日
            ey, em, ed = ty, tm, last
        elif d > 1:  # 同じ日の前日
            ey, em, ed = ty, tm, d - 1
        else:  # 1 日の前日は前の月の末日
            ey, em = (ty, tm - 1) if tm > 1 else (ty - 1, 12)
            ed = days_in(ey, em)
        out.append(f"{ey:04d}/{em:02d}/{ed:02d}")
    sys.stdout.write("\n".join(out) + "\n")


main()
