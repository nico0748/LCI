"""cp-0024 の全探索（小さい入力専用）。gen.py の stress から呼ばれる。

想定解（文字を 1 つずつ見るループ）とは別の考え方で、各規則を正規表現と集合で判定する。
"""
import re

ALLOWED = re.compile(r"[A-Za-z0-9!#$%&*+\-=?@_]*")


def brute(inp: str) -> str:
    lines = inp.split("\n")
    n = int(lines[0])
    out = []
    for i in range(1, n + 1):
        user, pw = lines[i].split(" ")
        broken = []
        broken.append(not (8 <= len(pw) <= 64))
        broken.append(ALLOWED.fullmatch(pw) is None)
        kinds = {("U" if c.isupper() else "L" if c.islower() else "D" if c.isdigit() else "S") for c in pw if c.isascii()}
        kinds &= {"U", "L", "D"} | ({"S"} if re.search(r"[!#$%&*+\-=?@_]", pw) else set())
        broken.append(len(kinds) < 3)
        broken.append(re.search(r"(.)\1\1", pw) is not None)
        broken.append(re.search(re.escape(user), pw, re.IGNORECASE) is not None)
        out.append(str(broken.index(True) + 1) if any(broken) else "OK")
    return "\n".join(out) + "\n"
