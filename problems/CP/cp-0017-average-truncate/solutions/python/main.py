import sys


def main() -> None:
    tok = sys.stdin.read().split()
    n = int(tok[0])
    names = tok[1 : 1 + 2 * n : 2]
    scores = list(map(int, tok[2 : 2 + 2 * n : 2]))
    total = sum(scores)
    # 浮動小数を使わず整数で: 平均×10 の切り捨て = total*10 // n（点数は 0 以上なので // は切り捨て）
    v = total * 10 // n
    out = [f"{v // 10}.{v % 10}"]  # 整数でも "70.0" の形で出す
    # 「平均以上」は表示用に切り捨てた値ではなく正確な平均と比べる: score >= total / n ⇔ score * n >= total
    out += [nm for nm, sc in zip(names, scores) if sc * n >= total]
    sys.stdout.write("\n".join(out) + "\n")


main()
