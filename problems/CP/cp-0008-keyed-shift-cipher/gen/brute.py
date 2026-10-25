"""cp-0008 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（剰余で一気に戻す）とは別の考え方で書く: 英字を 1 文字ずつ k 回「1 つ前の文字」に戻す（a の前は z）。
鍵の位置は「それまでに出てきた英字の個数」を毎回数え直して決める。
"""


def back_one(ch: str) -> str:
    if ch == "a":
        return "z"
    if ch == "A":
        return "Z"
    return chr(ord(ch) - 1)


def brute(inp: str) -> str:
    lines = inp.split("\n")
    key, s = lines[0], lines[1]
    out = []
    for i, ch in enumerate(s):
        if ch.isascii() and ch.isalpha():
            letters_before = sum(1 for c in s[:i] if c.isascii() and c.isalpha())
            k = ord(key[letters_before % len(key)]) - ord("a")
            for _ in range(k):
                ch = back_one(ch)
        out.append(ch)
    return "".join(out) + "\n"
