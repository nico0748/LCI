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


def check_password(password: str, user_id: str, email: str) -> list[str]:
    raise NotImplementedError


def hash_password(password: str, iterations: int = DEFAULT_ITERATIONS, salt: bytes | None = None) -> str:
    raise NotImplementedError


def verify_password(password: str, stored: str) -> bool:
    raise NotImplementedError


def needs_rehash(stored: str, iterations: int = DEFAULT_ITERATIONS) -> bool:
    raise NotImplementedError
