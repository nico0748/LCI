"""cp-0034 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解は「越えた分を式で戻す」が、こちらはコマを 1 マスずつ動かし、N に着いた時点で残りの歩数があれば
向きを反転する、という素直なシミュレーションで書く。
"""


def brute(inp: str) -> str:
    lines = inp.strip().split("\n")
    n, k = map(int, lines[0].split())
    dice = list(map(int, lines[1].split()))
    m = int(lines[2])
    warp = {}
    for line in lines[3 : 3 + m]:
        s, t = map(int, line.split())
        warp[s] = t
    pos = 0
    for turn in range(k):
        step = 1
        for _ in range(dice[turn]):
            if pos == n:
                step = -1
            pos += step
        if pos == n:
            return f"GOAL {turn + 1}\n"
        if pos in warp:
            pos = warp[pos]
    return f"{pos}\n"
