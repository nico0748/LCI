import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, k = int(tok[0]), int(tok[1])
    w = list(map(int, tok[2 : 2 + n]))

    def fits(cap: int) -> bool:
        """棚幅 cap で、左から詰めて K 段以内に収まるか（cap ≥ max(w) で呼ぶ）"""
        count, cur = 1, 0
        for x in w:
            cur += x
            if cur > cap:
                count += 1
                if count > k:
                    return False
                cur = x
        return True

    # 答えは [max(w), sum(w)] の中。sum(w) は最大 2×10^14（64bit が必要な大きさ）
    lo, hi = max(w), sum(w)
    while lo < hi:
        mid = (lo + hi) // 2
        if fits(mid):
            hi = mid
        else:
            lo = mid + 1
    print(lo)


main()
