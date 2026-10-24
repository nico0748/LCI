class RateLimiter:
    """token bucket 方式のレートリミッタ。

    キーごとに (残量, 最後に補充計算した時刻) だけを持ち、アクセス時に経過時間分をまとめて補充する。
    全キーをタイマーで補充しないので 1 呼び出し O(1)、キー数に比例する処理が無い。
    """

    def __init__(self, capacity: int, refill_per_sec: float) -> None:
        if not isinstance(capacity, int) or isinstance(capacity, bool) or capacity <= 0:
            raise ValueError("capacity は正の整数")
        if not refill_per_sec > 0:
            raise ValueError("refill_per_sec は正の数")
        self.capacity = capacity
        self.refill = float(refill_per_sec)
        self._buckets: dict[str, list[float]] = {}

    def _refill(self, key: str, now: float) -> list[float]:
        b = self._buckets.get(key)
        if b is None:
            b = [float(self.capacity), now]
            self._buckets[key] = b
            return b
        # 時刻が巻き戻った場合は経過 0 とみなし、last も戻さない（戻すと次回に二重補充される）
        elapsed = max(0.0, now - b[1])
        b[0] = min(float(self.capacity), b[0] + elapsed * self.refill)
        b[1] = max(b[1], now)
        return b

    def allow(self, key: str, now: float) -> bool:
        b = self._refill(key, now)
        if b[0] >= 1.0 - 1e-9:
            b[0] -= 1.0
            return True
        return False

    def retry_after(self, key: str, now: float) -> float:
        b = self._refill(key, now)
        missing = 1.0 - b[0]
        return 0.0 if missing <= 1e-9 else missing / self.refill
