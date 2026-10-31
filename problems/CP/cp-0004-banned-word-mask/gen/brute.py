"""cp-0004 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で書く: 正規表現の先読み (?=(語)) で、重なりも含めた一致位置をすべて列挙し、
その範囲を * に塗る。塗るのは原文のコピー上で、検索はいつも原文に対して行う。
"""
import re


def brute(inp: str) -> str:
    lines = inp.split("\n")
    n = int(lines[0])
    words = [lines[1 + i] for i in range(n)]
    s = lines[1 + n]
    out = list(s)
    for wd in words:
        for m in re.finditer("(?=" + re.escape(wd) + ")", s):
            for j in range(m.start(), m.start() + len(wd)):
                out[j] = "*"
    return "".join(out) + "\n"
