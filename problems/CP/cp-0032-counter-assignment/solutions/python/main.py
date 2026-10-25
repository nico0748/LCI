import sys


def main() -> None:
    tok = sys.stdin.read().split()
    n, m = int(tok[0]), int(tok[1])
    free = [0] * m  # 窓口 k が空く時刻（手続きが終わる時刻。その時刻ちょうどから空き）
    out = []
    p = 2
    for _ in range(n):
        a, d = int(tok[p]), int(tok[p + 1])
        p += 2
        s = max(a, min(free))  # 案内される時刻: 到着時か、最も早く空く時刻
        k = 0
        while free[k] > s:  # s の時点で空いている窓口のうち番号最小（free[k] == s も空き）
            k += 1
        free[k] = s + d
        out.append(f"{k + 1} {s - a}")
    sys.stdout.write("\n".join(out) + "\n")


main()
