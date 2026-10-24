import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, k = int(data[0]), int(data[1])
    seen: dict[int, int] = {}
    for j in range(n):
        x = int(data[2 + j])
        i = seen.get(k - x)
        if i is not None:
            print(i + 1, j + 1)
            return
        if x not in seen:
            seen[x] = j
    print(-1)


main()
