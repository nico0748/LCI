import sys


def main() -> None:
    data = sys.stdin.read().split()
    n, m = int(data[0]), int(data[1])
    points = [int(x) for x in data[2 : 2 + m]]
    score: dict[str, int] = {}
    seen: set[tuple[str, int]] = set()  # (名前, 地点) を 1 回だけ数える
    k = 2 + m
    for _ in range(n):
        name, c = data[k], int(data[k + 1])
        k += 2
        if (name, c) in seen:
            continue
        seen.add((name, c))
        score[name] = score.get(name, 0) + points[c - 1]
    # 得点の降順、同点は名前の昇順（英小文字だけなので str の比較がそのまま辞書順）
    top = sorted(score.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    sys.stdout.write("".join(f"{name} {s}\n" for name, s in top))


main()
