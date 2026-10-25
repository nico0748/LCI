import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    k = int(tok[0])
    n = 1 << k
    s = [0] * (n + 1)
    for i in range(n):
        s[i + 1] = int(tok[1 + i])
    line = [int(x) for x in tok[1 + n : 1 + 2 * n]]  # 表の左から並ぶ選手番号
    wins = [0] * (n + 1)
    while len(line) > 1:
        nxt = []
        for i in range(0, len(line), 2):
            a, b = line[i], line[i + 1]
            # 強さが大きい方、同じなら「番号が」小さい方（表の左右ではない）
            w = a if s[a] > s[b] or (s[a] == s[b] and a < b) else b
            wins[w] += 1
            nxt.append(w)
        line = nxt
    sys.stdout.write(f"{line[0]}\n{' '.join(map(str, wins[1:]))}\n")


main()
