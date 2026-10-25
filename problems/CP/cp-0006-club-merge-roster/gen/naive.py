# 素朴解（TLE させる想定）: 組ごとの名簿（list）を持ち、合併では a の組の全員を b の組へ付け替える。
# 大小を見ずに付け替えるので、鎖状の合併（1 1 2 / 1 2 3 / …）では毎回大きい組を動かし、合計 O(N^2) ≒ 5×10^9 回になる。
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    label = list(range(n + 1))
    members = [[i] for i in range(n + 1)]
    out = []
    p = 2
    for _ in range(q):
        t = tok[p]
        if t == b"2":
            out.append(len(members[label[int(tok[p + 1])]]))
            p += 2
            continue
        la, lb = label[int(tok[p + 1])], label[int(tok[p + 2])]
        p += 3
        if t == b"1":
            if la != lb:
                for x in members[la]:
                    label[x] = lb
                members[lb].extend(members[la])
                members[la] = []
        else:
            out.append("Yes" if la == lb else "No")
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
