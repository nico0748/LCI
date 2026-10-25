import sys

SYMBOLS = set("!#$%&*+-=?@_")


def judge(user: str, pw: str) -> str:
    # 規則 1: 長さ
    if not 8 <= len(pw) <= 64:
        return "1"
    upper = lower = digit = symbol = False
    for c in pw:
        if "A" <= c <= "Z":
            upper = True
        elif "a" <= c <= "z":
            lower = True
        elif "0" <= c <= "9":
            digit = True
        elif c in SYMBOLS:
            symbol = True
        else:
            return "2"  # 規則 2: 使えない文字
    # 規則 3: 4 種類のうち 3 種類以上
    if upper + lower + digit + symbol < 3:
        return "3"
    # 規則 4: 同じ文字の 3 連続（末尾で終わる連続も、数えた直後に判定するので漏れない）
    run = 1
    for i in range(1, len(pw)):
        run = run + 1 if pw[i] == pw[i - 1] else 1
        if run >= 3:
            return "4"
    # 規則 5: ユーザー名を含まない（大文字小文字を区別しない）
    if user.lower() in pw.lower():
        return "5"
    return "OK"


def main() -> None:
    lines = sys.stdin.read().split("\n")
    n = int(lines[0])
    out = []
    for i in range(1, n + 1):
        user, pw = lines[i].split(" ")
        out.append(judge(user, pw))
    sys.stdout.write("\n".join(out) + "\n")


main()
