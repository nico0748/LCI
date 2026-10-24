import sys


def main() -> None:
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[1])
    a = list(map(int, data[2 : 2 + n]))
    # ここに実装する
    print(-1)


main()
