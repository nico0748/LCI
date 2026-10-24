import asyncio
from typing import Any, Awaitable, Callable

User = dict[str, Any]


class UserLoader:
    """ユーザー情報を取得してキャッシュする。

    結果ではなく進行中の Task をキャッシュする。`in self.cache` を見てから await までの間に
    同じ id の load が来ても、2 回目以降は同じ Task を待つので取得は 1 回で済む。
    """

    def __init__(self, fetcher: Callable[[str], Awaitable[User]]) -> None:
        self.fetcher = fetcher
        self.cache: dict[str, asyncio.Future[User]] = {}

    async def load(self, user_id: str) -> User:
        task = self.cache.get(user_id)
        if task is None:
            task = asyncio.ensure_future(self.fetcher(user_id))
            self.cache[user_id] = task
            task.add_done_callback(lambda t, uid=user_id: self._forget_if_failed(uid, t))
        # shield: 待っている側の 1 人がキャンセルされても、共有の取得自体は止めない
        return await asyncio.shield(task)

    def _forget_if_failed(self, user_id: str, task: "asyncio.Future[User]") -> None:
        # 失敗した Task を残すと、その id は永遠に失敗を返す。まだ自分が登録されているときだけ消す
        failed = task.cancelled() or task.exception() is not None
        if failed and self.cache.get(user_id) is task:
            del self.cache[user_id]

    async def load_many(self, user_ids: list[str]) -> list[User]:
        # gather は入力の順番で結果を返す。1 つでも失敗すれば例外が伝わる
        return list(await asyncio.gather(*(self.load(u) for u in user_ids)))

    def clear(self, user_id: str) -> None:
        self.cache.pop(user_id, None)
