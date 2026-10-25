"""cp-0007 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（階を整数に直す）とは別の考え方で書く: B3, B2, B1, 1, 2, …, 99 を下から順に並べた一覧を作り、
停止階の一覧上の位置の差を数える（並びに 0 階が無いので、位置の差がそのまま移動階数）。
"""

ORDER = ["B3", "B2", "B1"] + [str(i) for i in range(1, 100)]


def brute(inp: str) -> str:
    lines = inp.split()
    n = int(lines[0])
    stops = lines[1 : 1 + n]
    total = 0
    for i in range(1, n):
        a, b = ORDER.index(stops[i - 1]), ORDER.index(stops[i])
        step = 1 if b > a else -1
        while a != b:  # 1 階ずつ動かして数える
            a += step
            total += 1
    return f"{total}\n"
