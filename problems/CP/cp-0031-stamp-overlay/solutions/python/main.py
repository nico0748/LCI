import sys


def main() -> None:
    # 絵柄の行は空白を含まないので、トークン区切りでまとめて読んでよい
    tok = sys.stdin.read().split()
    H, W, N = int(tok[0]), int(tok[1]), int(tok[2])
    canvas = [["."] * W for _ in range(H)]
    p = 3
    for _ in range(N):
        h, w, r, c = int(tok[p]), int(tok[p + 1]), int(tok[p + 2]), int(tok[p + 3])
        p += 4
        for i in range(h):
            y = r - 1 + i
            if 0 <= y < H:  # Python の負の添字は末尾を指すので、下側の範囲チェックも必須
                row = tok[p + i]
                cr = canvas[y]
                for j in range(w):
                    x = c - 1 + j
                    ch = row[j]
                    if ch != "." and 0 <= x < W:  # '.' は透過
                        cr[x] = ch
        p += h
    sys.stdout.write("\n".join("".join(r) for r in canvas) + "\n")


main()
