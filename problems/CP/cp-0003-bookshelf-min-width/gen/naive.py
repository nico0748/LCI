# 素朴解（TLE させる想定）: 棚幅を max(w) から 1 ずつ増やして、最初に K 段に収まった幅を答える。
# 判定は O(N) だが、試す幅の個数が「答え − max(w)」個（hidden-max-k2 では約 5×10^13 個）あり終わらない。
import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, k = int(tok[0]), int(tok[1])
    w = list(map(int, tok[2 : 2 + n]))
    cap = max(w)
    while True:
        count, cur = 1, 0
        for x in w:
            if cur + x > cap:
                count += 1
                cur = x
            else:
                cur += x
        if count <= k:
            print(cap)
            return
        cap += 1


main()
