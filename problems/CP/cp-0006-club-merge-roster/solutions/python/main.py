import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, q = int(tok[0]), int(tok[1])
    parent = list(range(n + 1))
    size = [1] * (n + 1)

    def find(x: int) -> int:
        # 再帰にしない（深さ 10^5 で RecursionError になりうる）。経路半減で木を浅く保つ
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    out = []
    p = 2
    for _ in range(q):
        t = tok[p]
        if t == b"2":
            out.append(size[find(int(tok[p + 1]))])
            p += 2
            continue
        a, b = find(int(tok[p + 1])), find(int(tok[p + 2]))
        p += 3
        if t == b"1":
            if a != b:  # 既に同じ組なら何もしない（人数を足し直さない）
                if size[a] < size[b]:
                    a, b = b, a
                parent[b] = a  # 小さい組を大きい組の下に付ける
                size[a] += size[b]
        else:
            out.append("Yes" if a == b else "No")
    sys.stdout.write("\n".join(map(str, out)) + "\n")


main()
