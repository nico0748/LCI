"""cp-0006 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（Union-Find）とは別の考え方で書く: サークルを「人の集合」のリストとしてそのまま持ち、
合併は 2 つの集合を取り除いて和集合を入れ直す。照会はリストを先頭から探す。
"""


def brute(inp: str) -> str:
    tok = inp.split()
    n, q = int(tok[0]), int(tok[1])
    groups = [{i} for i in range(1, n + 1)]

    def group_of(x: int) -> set:
        return next(g for g in groups if x in g)

    out = []
    p = 2
    for _ in range(q):
        t = tok[p]
        if t == "2":
            out.append(str(len(group_of(int(tok[p + 1])))))
            p += 2
            continue
        a, b = int(tok[p + 1]), int(tok[p + 2])
        p += 3
        ga, gb = group_of(a), group_of(b)
        if t == "1":
            if ga is not gb:
                groups.remove(ga)
                groups.remove(gb)
                groups.append(ga | gb)
        else:
            out.append("Yes" if ga is gb else "No")
    return "\n".join(out) + "\n"
