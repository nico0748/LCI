import sys


def main() -> None:
    data = sys.stdin.buffer.read().split(b"\n")
    h, w = map(int, data[0].split())
    w2 = w + 2
    # 周りを # で 1 周囲み、1 次元の bytearray にする（範囲チェックが要らなくなる）。上下左右は ±1, ±w2
    g = bytearray(b"#" * w2)
    for r in range(1, h + 1):
        g += b"#" + data[r][:w] + b"#"
    g += b"#" * w2
    DOT, WALL = 46, 35  # "." と "#"
    count = best = 0
    pos = g.find(b".")
    while pos != -1:
        count += 1
        g[pos] = WALL  # 訪問済みの印は「積むとき」に付ける（同じマスを 2 回積まない）
        stack = [pos]  # 再帰ではなく明示的なスタック（蛇行した 50 万マスの道でも深さの制限に当たらない）
        area = 0
        push = stack.append
        pop = stack.pop
        while stack:
            p = pop()
            area += 1
            q = p - 1
            if g[q] == DOT:
                g[q] = WALL
                push(q)
            q = p + 1
            if g[q] == DOT:
                g[q] = WALL
                push(q)
            q = p - w2
            if g[q] == DOT:
                g[q] = WALL
                push(q)
            q = p + w2
            if g[q] == DOT:
                g[q] = WALL
                push(q)
        if area > best:
            best = area
        pos = g.find(b".", pos)  # 次の未訪問の空きマスへ一気に飛ぶ
    sys.stdout.write(f"{count} {best}\n")


main()
