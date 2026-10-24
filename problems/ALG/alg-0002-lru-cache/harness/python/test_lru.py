import os
import sys
import time
import unittest

# python3 -I は cwd を sys.path に入れないので、ハーネスと同じディレクトリを明示的に足す
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lru import LRUCache  # noqa: E402


class TestLRU(unittest.TestCase):
    def test_basic(self) -> None:
        c = LRUCache(2)
        c.put(1, 1)
        c.put(2, 2)
        self.assertEqual(c.get(1), 1)
        c.put(3, 3)  # 2 が最古
        self.assertEqual(c.get(2), -1)
        c.put(4, 4)  # 1 が最古
        self.assertEqual(c.get(1), -1)
        self.assertEqual(c.get(3), 3)
        self.assertEqual(c.get(4), 4)

    def test_missing_returns_minus_one(self) -> None:
        self.assertEqual(LRUCache(1).get(42), -1)

    def test_get_refreshes(self) -> None:
        c = LRUCache(2)
        c.put(1, 1)
        c.put(2, 2)
        c.get(1)
        c.put(3, 3)
        self.assertEqual(c.get(1), 1, "get した 1 は追い出されないはず")
        self.assertEqual(c.get(2), -1)

    def test_update_does_not_evict(self) -> None:
        c = LRUCache(2)
        c.put(1, 1)
        c.put(2, 2)
        c.put(1, 10)
        self.assertEqual(c.get(1), 10)
        self.assertEqual(c.get(2), 2, "既存キーの更新で 2 を追い出してはいけない")

    def test_capacity_one(self) -> None:
        c = LRUCache(1)
        c.put(1, 1)
        c.put(2, 2)
        self.assertEqual(c.get(1), -1)
        self.assertEqual(c.get(2), 2)

    def test_large_ops(self) -> None:
        c = LRUCache(3000)
        t0 = time.perf_counter()
        for i in range(100000):
            c.put(i % 10000, i)
            c.get((i * 7) % 10000)
        self.assertLess(time.perf_counter() - t0, 3.0, "O(1) で動いていない可能性")
        self.assertEqual(c.get(99999 % 10000), 99999)


if __name__ == "__main__":
    unittest.main(verbosity=2)
