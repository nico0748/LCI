import sys

MOD = 10**9 + 7


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, k = int(tok[0]), int(tok[1])
    t = [0] + [int(x) for x in tok[2 : 2 + n]]
    a = [0] + [int(x) for x in tok[2 + n : 2 + 2 * n]]
    # 仕分け機 1 から順にたどり、各仕分け機に「何回目の移動の前にいたか」を記録する
    first = [-1] * (n + 1)
    order = []
    x = 1
    while first[x] < 0:
        first[x] = len(order)
        order.append(x)
        x = t[x]
    mu = first[x]  # 周期に入るまでの移動回数（尾の長さ）
    lam = len(order) - mu  # 周期の長さ
    pre = [0] * (len(order) + 1)  # pre[j] = 最初の j 回の移動で記録される手数料の合計
    for j, v in enumerate(order):
        pre[j + 1] = pre[j] + a[v]
    if k <= len(order):  # 周期を 1 周するまでに終わる（尾の途中で終わる場合も含む）
        print(t[order[k - 1]], pre[k] % MOD)
        return
    q, r = divmod(k - mu, lam)
    cyc = pre[mu + lam] - pre[mu]
    total = pre[mu] + q % MOD * (cyc % MOD) + (pre[mu + r] - pre[mu])
    print(order[mu + r], total % MOD)


main()
