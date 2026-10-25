import sys


def main() -> None:
    lines = sys.stdin.read().split("\n")
    h, w, k = map(int, lines[0].split())
    for r in range(h):
        row = lines[1 + r]
        run = 0  # この行で、いま続いている空席の数（行が変わったら 0 から数え直す）
        for c in range(w):
            if row[c] == ".":
                run += 1
                if run == k:  # K 席目に達した時点で、左端は c - k + 1（0 始まり）
                    sys.stdout.write(f"{r + 1} {c - k + 2}\n")
                    return
            else:
                run = 0
    sys.stdout.write("-1\n")


main()
