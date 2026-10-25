import sys


def main() -> None:
    tok = sys.stdin.buffer.read().split()
    n, c = int(tok[0]), int(tok[1])
    s = map(int, tok[2 : 2 + 2 * n : 2])
    e = map(int, tok[3 : 3 + 2 * n : 2])
    # 終了時刻の早い順に見る（開始順・長さ順の貪欲は反例がある）
    free_at = 0  # 次の予約が始まってよい最も早い時刻 = 直前に受けた予約の終了 + C
    cnt = 0
    for end, start in sorted(zip(e, s)):
        if start >= free_at:  # ちょうど「終了 + C」に始まる予約は受けられる
            cnt += 1
            free_at = end + c  # 最大 10^9 + 2×10^9（C/Go/Rust では 64bit で持つ）
    sys.stdout.write(f"{cnt}\n")


main()
