"""cp-0014 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解とは別の考え方で、素直に（遅くてよいので）書く。同じ間違いを共有しないため、solve() を流用しない。
ここでは照会時刻から 1 分ずつ時計を進め（24:00 で 00:00 に戻す）、発車時刻の文字列と一致した最初の時刻を答える。
"""


def brute(inp: str) -> str:
    tok = inp.split()
    n = int(tok[0])
    deps = set(tok[1 : 1 + n])
    q = int(tok[1 + n])
    out = []
    for s in tok[2 + n : 2 + n + q]:
        h, m = int(s[:2]), int(s[3:])
        wait = 0
        while f"{h:02d}:{m:02d}" not in deps:
            m += 1
            if m == 60:
                h, m = h + 1, 0
            if h == 24:
                h = 0
            wait += 1
        out.append(f"{h:02d}:{m:02d} {wait}")
    return "\n".join(out) + "\n"
