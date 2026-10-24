import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, k, t = int(data[0]), int(data[1]), int(data[2])
    a = list(map(int, data[3 : 3 + n]))
    # ここに実装する
    print("TODO")


main()
