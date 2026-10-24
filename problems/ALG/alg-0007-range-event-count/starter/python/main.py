import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    ts = list(map(int, data[2 : 2 + n]))
    queries = [(int(data[2 + n + 2 * j]), int(data[3 + n + 2 * j])) for j in range(q)]
    # ここに実装する
    print("TODO")


main()
