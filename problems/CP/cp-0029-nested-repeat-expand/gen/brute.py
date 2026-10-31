"""cp-0029 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（左から 1 回走査するスタック）とは別の考え方で、正規表現の置き換えを変化が無くなるまで繰り返す:
「数字 + 英小文字」を展開し、中身が英小文字だけになった「数字(…)」（いちばん内側）を展開する。
"""
import re

LETTER = re.compile(r"(\d+)([a-z])")
INNER = re.compile(r"(\d+)\(([a-z]*)\)")


def brute(inp: str) -> str:
    s = inp.split()[0]
    while True:
        t = LETTER.sub(lambda m: m.group(2) * int(m.group(1)), s)
        t = INNER.sub(lambda m: m.group(2) * int(m.group(1)), t)
        if t == s:
            break
        s = t
    assert re.fullmatch(r"[a-z]+", s), "展開しきれない（記法が不正）"
    return s + "\n"
