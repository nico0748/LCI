import sys


def level(s: str) -> int:
    # 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま）
    return 1 - int(s[1:]) if s[0] == "B" else int(s)


def main() -> None:
    tok = sys.stdin.read().split()
    n = int(tok[0])
    lv = [level(t) for t in tok[1 : 1 + n]]
    print(sum(abs(lv[i] - lv[i - 1]) for i in range(1, n)))


main()
