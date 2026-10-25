import sys

P = 998244353


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    q = int(tok[0])
    ns = list(map(int, tok[1 : 1 + 2 * q : 2]))
    rs = list(map(int, tok[2 : 2 + 2 * q : 2]))
    m = max(ns)
    # 階乗と、その逆元（フェルマーの小定理: a^(P−2) ≡ a^(−1)）を n の最大値まで前計算する
    fact = [1] * (m + 1)
    for i in range(1, m + 1):
        fact[i] = fact[i - 1] * i % P
    inv = [1] * (m + 1)
    inv[m] = pow(fact[m], P - 2, P)
    for i in range(m, 0, -1):
        inv[i - 1] = inv[i] * i % P  # 1/(i−1)! = i / i!
    out = []
    for n, r in zip(ns, rs):
        out.append(0 if r > n else fact[n] * inv[r] % P * inv[n - r] % P)
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
