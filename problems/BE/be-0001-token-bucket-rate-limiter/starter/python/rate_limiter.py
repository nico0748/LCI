class RateLimiter:
    """token bucket 方式のレートリミッタ。"""

    def __init__(self, capacity: int, refill_per_sec: float) -> None:
        raise NotImplementedError

    def allow(self, key: str, now: float) -> bool:
        raise NotImplementedError

    def retry_after(self, key: str, now: float) -> float:
        raise NotImplementedError
