import asyncio
from typing import Any, Awaitable, Callable

User = dict[str, Any]


class UserLoader:
    """ユーザー情報を取得してキャッシュする。"""

    def __init__(self, fetcher: Callable[[str], Awaitable[User]]) -> None:
        self.fetcher = fetcher
        self.cache: dict[str, User] = {}

    async def load(self, user_id: str) -> User:
        if user_id in self.cache:
            return self.cache[user_id]
        user = await self.fetcher(user_id)
        self.cache[user_id] = user
        return user

    async def load_many(self, user_ids: list[str]) -> list[User]:
        results: list[User] = []
        for user_id in user_ids:
            asyncio.ensure_future(self._append(user_id, results))
        return results

    async def _append(self, user_id: str, results: list[User]) -> None:
        results.append(await self.load(user_id))

    def clear(self, user_id: str) -> None:
        self.cache.pop(user_id, None)
