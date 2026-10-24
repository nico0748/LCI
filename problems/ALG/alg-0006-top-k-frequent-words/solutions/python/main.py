import heapq
import sys


def main() -> None:
    tokens = sys.stdin.read().split()
    n, k = int(tokens[0]), int(tokens[1])
    counts: dict[str, int] = {}
    for w in tokens[2 : 2 + n]:
        counts[w] = counts.get(w, 0) + 1
    # Counter.most_common は同点を出現順で返すので使わない。
    # (回数の降順, ワードの昇順) のキーで K 件だけ取る: O(U log K)
    top = heapq.nsmallest(k, counts.items(), key=lambda kv: (-kv[1], kv[0]))
    sys.stdout.write("".join(f"{w} {c}\n" for w, c in top))


main()
