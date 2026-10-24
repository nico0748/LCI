import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    n, k, t = int(data[0]), int(data[1]), int(data[2])
    a = list(map(int, data[3 : 3 + n]))
    # 窓をずらすたびに K 個を足し直すと O(NK)。新しい値を足し、抜ける値を引けば O(N)
    s = sum(a[:k])
    first, count = -1, 0
    for i in range(k, n + 1):  # i は 1 始まりの「分」
        if i > k:
            s += a[i - 1] - a[i - 1 - k]
        if s > t:
            count += 1
            if first < 0:
                first = i
    print(first, count)


main()
