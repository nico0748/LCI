import copy
import time
from typing import Callable

KEY_TTL_SEC = 24 * 60 * 60


class LikeApi:
    """いいね API（インメモリ）。

    冪等性を 2 段階で扱う:
    - 操作自体の冪等性: いいね状態を (user, post) の集合で持つので、何度いいねしても件数は 1 しか増えない
    - 応答の再現: Idempotency-Key ごとに最初の応答を保存し、再送には同じ応答を返す
      （再送してくるクライアントは最初の応答を受け取れていない可能性があるため）
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self.clock = clock
        self._likes: set[tuple[str, str]] = set()
        self._counts: dict[str, int] = {}
        # (user_id, key) -> (fingerprint, status, body, expires_at)。キーはユーザーごとの名前空間
        self._keys: dict[tuple[str, str], tuple[tuple[str, str], int, dict, float]] = {}

    def like(self, user_id: str, post_id: str, idempotency_key: str | None = None) -> tuple[int, dict]:
        return self._handle("like", user_id, post_id, idempotency_key)

    def unlike(self, user_id: str, post_id: str, idempotency_key: str | None = None) -> tuple[int, dict]:
        return self._handle("unlike", user_id, post_id, idempotency_key)

    def count(self, post_id: str) -> int:
        return self._counts.get(post_id, 0)

    def _handle(self, op: str, user_id: str, post_id: str, key: str | None) -> tuple[int, dict]:
        # 検証エラーは保存しない: 直して同じキーで送り直せるようにするため
        if not user_id or not post_id:
            return 400, {"error": "invalid_request"}
        now = self.clock()
        fingerprint = (op, post_id)
        if key is not None:
            saved = self._keys.get((user_id, key))
            if saved is not None and saved[3] > now:
                if saved[0] != fingerprint:
                    return 422, {"error": "idempotency_key_reused"}
                return saved[1], copy.deepcopy(saved[2])
        status, body = self._apply(op, user_id, post_id)
        if key is not None:
            self._keys[(user_id, key)] = (fingerprint, status, copy.deepcopy(body), now + KEY_TTL_SEC)
        return status, body

    def _apply(self, op: str, user_id: str, post_id: str) -> tuple[int, dict]:
        pair = (user_id, post_id)
        if op == "like":
            if pair in self._likes:
                status = 200
            else:
                self._likes.add(pair)
                self._counts[post_id] = self._counts.get(post_id, 0) + 1
                status = 201
            liked = True
        else:
            if pair in self._likes:
                self._likes.remove(pair)
                self._counts[post_id] = max(0, self._counts.get(post_id, 0) - 1)
            status = 200
            liked = False
        return status, {"post_id": post_id, "liked": liked, "like_count": self.count(post_id)}
