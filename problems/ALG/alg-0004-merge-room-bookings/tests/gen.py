"""テストケース生成（固定シードで決定的）。期待値は「イベント方式」で独立に計算し、小さいケースは時刻ごとの塗りつぶしでも照合する。

実行: python3 tests/gen.py   （problem ディレクトリで）
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))


def by_events(bs):
    ev = []
    for s, e in bs:
        ev.append((s, 0))  # 同時刻は開始(0)を終了(1)より先に処理 → 接する区間がつながる
        ev.append((e, 1))
    ev.sort()
    res, depth, start = [], 0, None
    for t, kind in ev:
        if kind == 0:
            if depth == 0:
                start = t
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                res.append((start, t))
    # 同時刻で 0→… と処理しているので、終了 t と次の開始 t が同じなら上で既につながっている
    return res


def by_paint(bs):
    hi = max(e for _, e in bs)
    used = [False] * (hi + 1)
    for s, e in bs:
        for t in range(s, e):
            used[t] = True
    res, t = [], 0
    while t <= hi:
        if used[t]:
            u = t
            while u <= hi and used[u]:
                u += 1
            res.append((t, u))
            t = u
        else:
            t += 1
    return res


def write(name, bs):
    with open(os.path.join(HERE, f"{name}.in"), "w") as f:
        f.write(f"{len(bs)}\n" + "".join(f"{s} {e}\n" for s, e in bs))
    ans = by_events(bs)
    if max(e for _, e in bs) <= 5000:
        assert ans == by_paint(bs), name
    with open(os.path.join(HERE, f"{name}.out"), "w") as f:
        f.write(f"{len(ans)}\n" + "".join(f"{s} {e}\n" for s, e in ans))


def main():
    rng = random.Random(4)
    write("01", [(9, 12), (1, 3), (2, 5), (5, 6)])
    write("02", [(1, 2), (4, 5), (7, 8)])
    write("11", [(1, 10), (2, 3), (4, 5)])            # 内包（終了を縮めない）
    write("12", [(1, 3), (3, 5), (5, 7)])             # 接する区間の連鎖
    write("13", [(5, 6)])                             # 1 件
    write("14", [(3, 8)] * 5)                         # 同一予約の重複
    write("15", [(10, 20), (0, 5), (19, 30), (5, 9)])  # 逆順・ばらばら
    small = []
    for _ in range(300):
        s = rng.randint(0, 4000)
        small.append((s, s + rng.randint(1, 60)))
    write("16", small)
    n = 200000
    big = []
    for _ in range(n):
        # 開始を 10^7 までに詰めて重なりを多くする（出力が大きくなりすぎないように）
        s = rng.randint(0, 10**7)
        big.append((s, s + rng.randint(1, 600)))
    write("17", big)
    # 1 本に全部つながる大ケース（降順に並べて最悪のソート入力に近づける）
    chain = [(i * 5, i * 5 + 5) for i in range(n // 2)]
    chain.reverse()
    write("18", chain)
    write("19", [(0, 10**9)] + [(rng.randint(0, 10**9 - 2), 10**9 - 1) for _ in range(n // 2 - 1)])


if __name__ == "__main__":
    main()
