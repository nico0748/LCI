import sys


def main() -> None:
    s = sys.stdin.readline().strip()
    # stack[-1] は今いる括弧の中で、ここまでに展開した文字列の断片
    stack: list[list[str]] = [[]]
    counts: list[int] = []  # 開いている括弧ごとの回数
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch.isdigit():
            j = i
            while s[j].isdigit():  # 回数は複数桁（例: 999a、12(…)）
                j += 1
            k = int(s[i:j])
            if s[j] == "(":
                counts.append(k)
                stack.append([])
            else:  # 数字の直後の英小文字 1 文字だけを k 個
                stack[-1].append(s[j] * k)
            i = j + 1
        elif ch == ")":
            body = "".join(stack.pop())
            stack[-1].append(body * counts.pop())
            i += 1
        else:
            stack[-1].append(ch)
            i += 1
    sys.stdout.write("".join(stack[0]) + "\n")


main()
