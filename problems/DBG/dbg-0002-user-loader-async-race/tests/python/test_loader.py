import asyncio
import unittest

from loader import UserLoader


class FakeApi:
    """id ごとに遅延を変えられ、呼び出し回数を数える偽のユーザー API。"""

    def __init__(self, delays=None, fail_times=None):
        self.calls: dict[str, int] = {}
        self.delays = delays or {}
        self.fail_times = dict(fail_times or {})

    async def __call__(self, user_id: str):
        self.calls[user_id] = self.calls.get(user_id, 0) + 1
        await asyncio.sleep(self.delays.get(user_id, 0.01))
        if self.fail_times.get(user_id, 0) > 0:
            self.fail_times[user_id] -= 1
            raise RuntimeError(f"api down: {user_id}")
        return {"id": user_id, "name": f"user {user_id}"}

    def total(self):
        return sum(self.calls.values())


class TestLoader(unittest.IsolatedAsyncioTestCase):
    async def test_load_and_cache(self):
        api = FakeApi()
        loader = UserLoader(api)
        self.assertEqual(await loader.load("u1"), {"id": "u1", "name": "user u1"})
        self.assertEqual(await loader.load("u1"), {"id": "u1", "name": "user u1"})
        self.assertEqual(api.calls, {"u1": 1})

    async def test_concurrent_loads_fetch_once(self):
        api = FakeApi()
        loader = UserLoader(api)
        users = await asyncio.gather(*(loader.load("u1") for _ in range(20)))
        self.assertEqual(api.calls, {"u1": 1})
        self.assertTrue(all(u == {"id": "u1", "name": "user u1"} for u in users))

    async def test_load_many_waits_and_keeps_order(self):
        api = FakeApi(delays={"a": 0.05, "b": 0.01, "c": 0.03})
        loader = UserLoader(api)
        users = await loader.load_many(["a", "b", "c"])
        self.assertEqual([u["id"] for u in users], ["a", "b", "c"])

    async def test_load_many_with_duplicates(self):
        api = FakeApi(delays={"a": 0.03, "b": 0.01})
        loader = UserLoader(api)
        users = await loader.load_many(["a", "b", "a", "a", "b"])
        self.assertEqual([u["id"] for u in users], ["a", "b", "a", "a", "b"])
        self.assertEqual(api.calls, {"a": 1, "b": 1})

    async def test_load_many_empty(self):
        self.assertEqual(await UserLoader(FakeApi()).load_many([]), [])

    async def test_failure_is_not_cached(self):
        api = FakeApi(fail_times={"u1": 1})
        loader = UserLoader(api)
        with self.assertRaises(RuntimeError):
            await loader.load("u1")
        self.assertEqual((await loader.load("u1"))["id"], "u1")
        self.assertEqual(api.calls, {"u1": 2})
        await loader.load("u1")
        self.assertEqual(api.calls, {"u1": 2})

    async def test_concurrent_failure_shared_then_retry(self):
        api = FakeApi(fail_times={"u1": 1})
        loader = UserLoader(api)
        results = await asyncio.gather(loader.load("u1"), loader.load("u1"), return_exceptions=True)
        self.assertTrue(all(isinstance(r, RuntimeError) for r in results))
        self.assertEqual(api.calls, {"u1": 1})
        self.assertEqual((await loader.load("u1"))["id"], "u1")
        self.assertEqual(api.calls, {"u1": 2})

    async def test_load_many_fails_if_any_fails(self):
        api = FakeApi(fail_times={"b": 1})
        loader = UserLoader(api)
        with self.assertRaises(RuntimeError):
            await loader.load_many(["a", "b", "c"])
        users = await loader.load_many(["a", "b", "c"])
        self.assertEqual([u["id"] for u in users], ["a", "b", "c"])
        self.assertEqual(api.calls["a"], 1)
        self.assertEqual(api.calls["b"], 2)

    async def test_clear(self):
        api = FakeApi()
        loader = UserLoader(api)
        await loader.load("u1")
        loader.clear("u1")
        await loader.load("u1")
        self.assertEqual(api.calls, {"u1": 2})
        loader.clear("never-loaded")


if __name__ == "__main__":
    unittest.main()
