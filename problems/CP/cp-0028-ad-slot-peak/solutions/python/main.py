import sys


def main() -> None:
    t = list(map(int, sys.stdin.buffer.read().split()))
    n = t[0]
    # 時刻ごとの増減をまとめる（同じ時刻の終了 −c と開始 +c は先に相殺される = 終了を先に処理するのと同じ）
    delta: dict[int, int] = {}
    for i in range(1, 3 * n + 1, 3):
        s, e, c = t[i], t[i + 1], t[i + 2]
        delta[s] = delta.get(s, 0) + c
        delta[e] = delta.get(e, 0) - c
    cur, best, at = 0, -1, -1
    for x in sorted(delta):  # 変化する時刻だけを昇順に見る（座標圧縮）
        cur += delta[x]
        if cur > best:  # 同じ値なら更新しない → 最初の時刻が残る
            best, at = cur, x
    sys.stdout.write(f"{best} {at}\n")


main()
