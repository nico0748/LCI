import sys


def to_min(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def main() -> None:
    tok = sys.stdin.read().split()
    n = int(tok[0])
    deps = sorted(to_min(s) for s in tok[1 : 1 + n])  # 入力は時刻順とは限らない
    q = int(tok[1 + n])
    out = []
    for s in tok[2 + n : 2 + n + q]:
        u = to_min(s)
        dep = next((d for d in deps if d >= u), None)  # ちょうどの時刻の便にも乗れる（>= で比べる）
        if dep is None:  # 今日の便はもう無い → 翌日の始発。待ち時間は 1440 分を足して数える
            dep, wait = deps[0], deps[0] + 1440 - u
        else:
            wait = dep - u
        out.append(f"{dep // 60:02d}:{dep % 60:02d} {wait}")  # 時・分とも 2 桁に 0 埋め
    sys.stdout.write("\n".join(out) + "\n")


main()
