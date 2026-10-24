import sqlite3
import unittest

from query import build_post_search

ROWS = [
    # id, author_id, title, status, created_at, like_count
    (1, 10, "夕焼けの街", "published", 1000, 5),
    (2, 10, "100% オリジナル", "published", 2000, 50),
    (3, 20, "1000 users 記念", "draft", 3000, 50),
    (4, 20, "a_b テスト", "published", 4000, 1),
    (5, 30, "axb テスト", "archived", 5000, 0),
    (6, 30, "C:\\path の話", "published", 6000, 7),
    (7, 10, "It's a cat", "published", 7000, 99),
]


class TestQuery(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("CREATE TABLE posts(id INTEGER PRIMARY KEY, author_id INTEGER, title TEXT, status TEXT, created_at INTEGER, like_count INTEGER)")
        self.db.executemany("INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?)", ROWS)

    def tearDown(self):
        self.db.close()

    def run_ids(self, *args, **kwargs):
        sql, params = build_post_search(*args, **kwargs)
        self.assertIsInstance(params, list)
        return [r[0] for r in self.db.execute(sql, params).fetchall()]

    def assertTableIntact(self):
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM posts").fetchone()[0], len(ROWS))

    def test_no_filters_default_sort_and_limit(self):
        self.assertEqual(self.run_ids({}), [7, 6, 5, 4, 3, 2, 1])
        self.assertEqual(self.run_ids({}, limit=2), [7, 6])

    def test_author_and_status(self):
        self.assertEqual(self.run_ids({"author_id": 10, "status": "published"}), [7, 2, 1])

    def test_created_range_inclusive(self):
        self.assertEqual(self.run_ids({"created_from": 2000, "created_to": 4000}, sort="created_at"), [2, 3, 4])

    def test_sorts(self):
        self.assertEqual(self.run_ids({}, sort="-like_count"), [7, 3, 2, 6, 1, 4, 5])
        self.assertEqual(self.run_ids({}, sort="like_count"), [5, 4, 1, 6, 3, 2, 7])
        self.assertEqual(self.run_ids({}, sort="id"), [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(self.run_ids({}, sort="-id"), [7, 6, 5, 4, 3, 2, 1])

    def test_title_contains(self):
        self.assertEqual(self.run_ids({"title_contains": "テスト"}, sort="id"), [4, 5])

    def test_like_wildcards_are_literal(self):
        self.assertEqual(self.run_ids({"title_contains": "100%"}), [2])
        self.assertEqual(self.run_ids({"title_contains": "a_b"}), [4])
        self.assertEqual(self.run_ids({"title_contains": "%"}), [2])
        self.assertEqual(self.run_ids({"title_contains": "C:\\"}), [6])

    def test_quote_in_value(self):
        self.assertEqual(self.run_ids({"title_contains": "It's"}), [7])

    def test_injection_in_value(self):
        for payload in ("x' OR '1'='1", "'; DROP TABLE posts; --", "%' OR 1=1 --"):
            sql, params = build_post_search({"title_contains": payload})
            self.assertNotIn(payload, sql)
            self.assertEqual([r[0] for r in self.db.execute(sql, params).fetchall()], [])
            self.assertTableIntact()

    def test_injection_in_sort_rejected(self):
        for bad in ("created_at; DROP TABLE posts", "created_at DESC", "title", "(SELECT 1)", "", "-"):
            with self.assertRaises(ValueError, msg=bad):
                build_post_search({}, sort=bad)

    def test_type_checks(self):
        for f in ({"author_id": "1 OR 1=1"}, {"author_id": 1.5}, {"author_id": True}, {"created_from": "0"}, {"title_contains": 123}, {"ids": [1, "2"]}, {"ids": "1,2"}):
            with self.assertRaises(ValueError, msg=repr(f)):
                build_post_search(f)

    def test_status_allowlist(self):
        with self.assertRaises(ValueError):
            build_post_search({"status": "published' OR '1'='1"})

    def test_unknown_key_rejected(self):
        for f in ({"author_id = 1 OR 1": 1}, {"title": "x"}, {"1=1; --": 0}):
            with self.assertRaises(ValueError, msg=repr(f)):
                build_post_search(f)

    def test_ids(self):
        self.assertEqual(self.run_ids({"ids": [3, 1, 99]}, sort="id"), [1, 3])
        self.assertEqual(self.run_ids({"ids": []}), [])
        with self.assertRaises(ValueError):
            build_post_search({"ids": list(range(101))})

    def test_limit_bounds(self):
        for bad in (0, -1, 101):
            with self.assertRaises(ValueError):
                build_post_search({}, limit=bad)
        self.assertEqual(len(self.run_ids({}, limit=100)), 7)

    def test_combined(self):
        self.assertEqual(self.run_ids({"author_id": 20, "created_from": 3500, "title_contains": "テスト"}), [4])


if __name__ == "__main__":
    unittest.main()
