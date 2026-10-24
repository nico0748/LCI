"""テストケース生成（固定シードで決定的）。期待値は小さいケースは全件数え上げ、大きいケースは
オフラインの尺取り（問い合わせの端点をソートして 1 回なめる）で、参照解の二分探索とは独立に計算する。

実行: python3 tests/gen.py   （problem ディレクトリで）
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))


def brute(ts, qs):
    return [sum(1 for t in ts if l <= t <= r) for l, r in qs]


def offline(ts, qs):
    s = sorted(ts)

    def count_le(xs):  # 各 x について「x 以下の個数」（strict=False）
        order = sorted(range(len(xs)), key=lambda i: xs[i])
        res = [0] * len(xs)
        p = 0
        for i in order:
            while p < len(s) and s[p] <= xs[i]:
                p += 1
            res[i] = p
        return res

    le_r = count_le([r for _, r in qs])
    lt_l = count_le([l - 1 for l, _ in qs])  # 整数なので「l 未満」=「l-1 以下」
    return [a - b for a, b in zip(le_r, lt_l)]


def write(name, ts, qs):
    with open(os.path.join(HERE, f"{name}.in"), "w") as f:
        f.write(f"{len(ts)} {len(qs)}\n{' '.join(map(str, ts))}\n")
        f.write("".join(f"{l} {r}\n" for l, r in qs))
    ans = offline(ts, qs)
    if len(ts) * len(qs) <= 10**6:
        assert ans == brute(ts, qs), name
    with open(os.path.join(HERE, f"{name}.out"), "w") as f:
        f.write("".join(f"{a}\n" for a in ans))


def main():
    rng = random.Random(7)
    write("01", [30, 10, 20, 20, 50, 40], [(10, 20), (21, 39), (0, 100), (45, 45)])
    write("02", [5], [(5, 5), (0, 4), (6, 10), (0, 10**9)])
    write("11", [7] * 10 + [3, 11], [(7, 7), (6, 6), (8, 8), (3, 11), (4, 10)])  # 重複と境界ちょうど
    write("12", [0, 10**9], [(0, 0), (10**9, 10**9), (1, 10**9 - 1), (0, 10**9)])  # 値の両端
    # 文字列順と数値順が違う時刻（Array#sort の落とし穴）
    write("13", [100, 9, 25, 3, 1000, 80], [(9, 100), (10, 99), (3, 3), (81, 1000)])
    ts = [rng.randint(0, 1000) for _ in range(500)]
    qs = []
    for _ in range(500):
        l = rng.randint(0, 1000)
        qs.append((l, rng.randint(l, 1000)))
    write("14", ts, qs)
    n = q = 200000
    ts = [rng.randint(0, 10**9) for _ in range(n)]
    qs = []
    for _ in range(q):
        l = rng.randint(0, 10**9)
        qs.append((l, min(10**9, l + rng.randint(0, 10**7))))
    write("21", ts, qs)
    # 少数の時刻に集中（重複が大量）＋ 端点がイベント時刻ちょうどの問い合わせ
    hot = sorted(rng.sample(range(0, 10**6), 50))
    ts = [rng.choice(hot) for _ in range(n // 4)]
    qs = []
    for _ in range(q // 4):
        a, b = sorted(rng.sample(hot, 2))
        qs.append((a, b) if rng.random() < 0.7 else (a, a))
    write("22", ts, qs)


if __name__ == "__main__":
    main()
