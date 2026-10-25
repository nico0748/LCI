import sys


def main() -> None:
    data = sys.stdin.buffer.read().split()
    h, w = int(data[0]), int(data[1])
    W2 = w + 2
    # 周りを壁で囲んだ 1 次元の盤面。free[p] = 1 は「まだ訪れていない道のマス」
    free = bytearray(W2 * (h + 2))
    cur = []
    dots = 0
    for i in range(h):
        row = data[2 + i]
        base = (i + 1) * W2 + 1
        free[base : base + w] = row.translate(TABLE)  # '.' → 1、'#' と 'S' → 0
        dots += row.count(b".")
        j = row.find(b"S")
        while j >= 0:
            cur.append(base + j)
            j = row.find(b"S", j + 1)
    if not cur:
        print(-1, dots)
        return
    # 多始点 BFS を段ごとに行う。避難所すべてが距離 0 の段
    reached = 0
    d = 0
    while True:
        nxt = []
        push = nxt.append
        for p in cur:
            q = p - 1
            if free[q]:
                free[q] = 0
                push(q)
            q = p + 1
            if free[q]:
                free[q] = 0
                push(q)
            q = p - W2
            if free[q]:
                free[q] = 0
                push(q)
            q = p + W2
            if free[q]:
                free[q] = 0
                push(q)
        if not nxt:
            break
        reached += len(nxt)
        d += 1
        cur = nxt
    print(d, dots - reached)


TABLE = bytes(1 if c == ord(".") else 0 for c in range(256))
main()
