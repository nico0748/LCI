import sys


def main() -> None:
    # 暗号文には空白が続くことがあるので、split() ではなく行で読む
    lines = sys.stdin.read().split("\n")
    key = [ord(c) - 97 for c in lines[0].strip()]
    s = lines[1].rstrip("\r")
    m = len(key)
    j = 0  # 鍵の位置。英字を 1 文字戻したときだけ進める
    out = []
    for ch in s:
        if "a" <= ch <= "z":
            # Python の % は結果が 0..25 になる（C/Go/Rust/TS では + 26 してから % を取る）
            out.append(chr((ord(ch) - 97 - key[j % m]) % 26 + 97))
            j += 1
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 - key[j % m]) % 26 + 65))
            j += 1
        else:
            out.append(ch)
    sys.stdout.write("".join(out) + "\n")


main()
