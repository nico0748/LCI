"""テストケース生成（固定シードで決定的）。期待値は素朴解（小さいケース）と累積和（大きいケース）で独立に計算する。

実行: python3 tests/gen.py   （problem ディレクトリで）
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))


def brute(n, k, t, a):
    hits = [i for i in range(k, n + 1) if sum(a[i - k : i]) > t]
    return (hits[0] if hits else -1, len(hits))


def prefix(n, k, t, a):
    p = [0]
    for x in a:
        p.append(p[-1] + x)
    hits = [i for i in range(k, n + 1) if p[i] - p[i - k] > t]
    return (hits[0] if hits else -1, len(hits))


def write(name, n, k, t, a):
    with open(os.path.join(HERE, f"{name}.in"), "w") as f:
        f.write(f"{n} {k} {t}\n{' '.join(map(str, a))}\n")
    ans = brute(n, k, t, a) if n * k <= 10**6 else prefix(n, k, t, a)
    if n * k <= 10**6:
        assert ans == prefix(n, k, t, a)
    with open(os.path.join(HERE, f"{name}.out"), "w") as f:
        f.write(f"{ans[0]} {ans[1]}\n")


def main():
    rng = random.Random(3)
    write("01", 6, 3, 10, [1, 5, 3, 4, 6, 0])
    write("02", 5, 2, 100, [10, 20, 30, 40, 50])
    write("03", 1, 1, 0, [1])
    write("11", 4, 4, 10, [1, 2, 3, 4])            # K = N、ちょうど T は超えない
    write("12", 4, 4, 9, [1, 2, 3, 4])             # K = N で超える
    write("13", 8, 1, 5, [5, 6, 5, 7, 0, 5, 9, 5])  # K = 1
    write("14", 10, 3, 0, [0] * 10)                 # 全部 0、T = 0
    n = 200000
    write("15", n // 4, n // 8, 10**15, [10**9] * (n // 4))     # 合計 10^14 だが T が大きく超えない
    write("16", n, 100000, 99999 * 10**9, [10**9] * n)  # 2^32 を超える合計、すべての窓が超える
    a = [rng.randint(0, 1000) for _ in range(n)]
    a[150000:150050] = [10**9] * 50
    write("17", n, 1000, 30 * 10**9, a)             # 後半の急増だけ検出
    write("18", n // 4, 7, 3500, [rng.randint(0, 1000) for _ in range(n // 4)])


if __name__ == "__main__":
    main()
