import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    bookings = [(int(data[1 + 2 * i]), int(data[2 + 2 * i])) for i in range(n)]
    # ここに実装する
    print("TODO")


main()
