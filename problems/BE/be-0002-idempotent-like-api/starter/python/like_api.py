import time
from typing import Callable


class LikeApi:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock = clock

    def like(self, user_id: str, post_id: str, idempotency_key: str | None = None) -> tuple[int, dict]:
        raise NotImplementedError

    def unlike(self, user_id: str, post_id: str, idempotency_key: str | None = None) -> tuple[int, dict]:
        raise NotImplementedError

    def count(self, post_id: str) -> int:
        raise NotImplementedError
