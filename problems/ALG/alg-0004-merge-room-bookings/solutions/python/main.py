import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    bookings = sorted((int(data[1 + 2 * i]), int(data[2 + 2 * i])) for i in range(n))
    merged: list[list[int]] = []
    for s, e in bookings:
        # 半開区間なので s == 直前の終了 でもつながっている扱い（s <= ce）
        if merged and s <= merged[-1][1]:
            # 内包された予約で終了が縮まないよう max を取る
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    out = [str(len(merged))]
    out.extend(f"{s} {e}" for s, e in merged)
    sys.stdout.write("\n".join(out) + "\n")


main()
