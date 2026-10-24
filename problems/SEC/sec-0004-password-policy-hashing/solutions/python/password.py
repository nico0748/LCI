import base64
import binascii
import hashlib
import hmac
import os
import re
import unicodedata

# よく使われるパスワード（本番では漏えい済みパスワードの大規模リストや API を使う）
COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password1",
        "password123",
        "password1234",
        "123456789012",
        "qwertyuiopas",
        "iloveyou1234",
        "letmein12345",
        "adminadmin12",
        "welcome12345",
        "abcdefghijkl",
        "passw0rd1234",
    }
)

DEFAULT_ITERATIONS = 600_000
ALGORITHM = "pbkdf2_sha256"
MIN_LEN = 12
# 上限はハッシュ計算を重くする DoS への対策（bcrypt なら 72 バイトで切り捨てられる問題もある）
MAX_LEN = 128
SALT_BYTES = 16
DK_BYTES = 32
_REPEAT = re.compile(r"(.)\1{3,}", re.DOTALL)


def _norm(s: str) -> str:
    # 全角英数・半角カナなどの表記ゆれを吸収。IME 設定でログインできなくなるのを防ぐ
    return unicodedata.normalize("NFKC", s)


def check_password(password: str, user_id: str, email: str) -> list[str]:
    """受け入れられない理由のコードを決まった順に返す。

    文字種（記号・大文字必須など）のルールは課さない（NIST SP 800-63B）。長さ・漏えい語・個人情報を見る。
    """
    p = _norm(password)
    low = p.lower()
    reasons: list[str] = []
    n = len(p)  # Python の len はコードポイント数
    if n < MIN_LEN:
        reasons.append("too_short")
    if n > MAX_LEN:
        reasons.append("too_long")
    if low in COMMON_PASSWORDS:
        reasons.append("common")
    local = _norm(email).lower().split("@", 1)[0]
    personal = [t for t in (_norm(user_id).lower(), local) if len(t) >= 3]
    if any(t in low for t in personal):
        reasons.append("contains_user_info")
    if _REPEAT.search(p):
        reasons.append("repetitive")
    return reasons


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _derive(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", _norm(password).encode("utf-8"), salt, iterations, DK_BYTES)


def hash_password(password: str, iterations: int = DEFAULT_ITERATIONS, salt: bytes | None = None) -> str:
    if salt is None:
        salt = os.urandom(SALT_BYTES)  # パスワードごとにランダム。同じパスワードでも保存値が変わる
    dk = _derive(password, salt, iterations)
    return f"{ALGORITHM}${iterations}${_b64(salt)}${_b64(dk)}"


def _parse(stored: str) -> tuple[int, bytes, bytes] | None:
    if not isinstance(stored, str):
        return None
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != ALGORITHM or not parts[1].isdigit():
        return None
    iterations = int(parts[1])
    if iterations < 1:
        return None
    try:
        salt = base64.b64decode(parts[2], validate=True)
        dk = base64.b64decode(parts[3], validate=True)
    except (binascii.Error, ValueError):
        return None
    if not salt or len(dk) != DK_BYTES:
        return None
    return iterations, salt, dk


def verify_password(password: str, stored: str) -> bool:
    parsed = _parse(stored)
    if parsed is None:
        return False  # 壊れた保存値は不一致として扱う（例外でログイン処理を落とさない）
    iterations, salt, dk = parsed
    return hmac.compare_digest(_derive(password, salt, iterations), dk)


def needs_rehash(stored: str, iterations: int = DEFAULT_ITERATIONS) -> bool:
    parsed = _parse(stored)
    return parsed is None or parsed[0] < iterations
