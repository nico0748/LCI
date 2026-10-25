import sys


def main() -> None:
    # 本文には空白が続くことがあるので、split() ではなく行で読む
    lines = sys.stdin.read().split("\n")
    n = int(lines[0])
    words = [lines[1 + i].strip() for i in range(n)]
    s = lines[1 + n].rstrip("\r")
    # 原文の上で一致を探して印だけ付ける（置換した文字列で次の語を探さない。重なった一致も拾う）
    mark = [False] * len(s)
    for wd in words:
        m = len(wd)
        for i in range(len(s) - m + 1):
            if s.startswith(wd, i):
                for j in range(i, i + m):
                    mark[j] = True
    sys.stdout.write("".join("*" if mark[i] else ch for i, ch in enumerate(s)) + "\n")


main()
