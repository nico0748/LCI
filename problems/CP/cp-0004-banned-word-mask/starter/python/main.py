import sys


def main() -> None:
    # 標準入力をまとめて読む（input() を何度も呼ぶより速い）
    data = sys.stdin.read()
    # 例: tokens = data.split()  /  lines = data.split("\n")（空白を含む行はこちら）
    # TODO: 入力を解析して答えを求める
    # 出力はまとめて 1 回で書く（例: sys.stdout.write("\n".join(map(str, ans)) + "\n")）
    del data


main()
