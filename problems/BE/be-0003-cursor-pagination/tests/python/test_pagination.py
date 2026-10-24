import random
import unittest

from pagination import paginate


def post(i, t):
    return {"id": i, "created_at": t, "title": f"post {i}"}


def ids(page):
    return [p["id"] for p in page["items"]]


def walk(posts, limit):
    out, cursor, pages = [], None, 0
    while True:
        page = paginate(posts, limit, cursor)
        out.extend(ids(page))
        pages += 1
        cursor = page["next_cursor"]
        if cursor is None or pages > 1000:
            return out, pages


class TestPagination(unittest.TestCase):
    def test_first_page_newest_first(self):
        posts = [post(1, 100), post(2, 200), post(3, 300), post(4, 400)]
        page = paginate(posts, 2)
        self.assertEqual(ids(page), [4, 3])
        self.assertIsInstance(page["next_cursor"], str)

    def test_second_page(self):
        posts = [post(i, i * 10) for i in range(1, 6)]
        p1 = paginate(posts, 2)
        p2 = paginate(posts, 2, p1["next_cursor"])
        p3 = paginate(posts, 2, p2["next_cursor"])
        self.assertEqual(ids(p1) + ids(p2) + ids(p3), [5, 4, 3, 2, 1])
        self.assertIsNone(p3["next_cursor"])

    def test_unsorted_input(self):
        posts = [post(3, 300), post(1, 100), post(4, 400), post(2, 200)]
        random.Random(7).shuffle(posts)
        self.assertEqual(walk(posts, 3)[0], [4, 3, 2, 1])

    def test_new_post_inserted_between_pages_no_duplicate(self):
        posts = [post(i, i * 10) for i in range(1, 7)]
        p1 = paginate(posts, 3)
        self.assertEqual(ids(p1), [6, 5, 4])
        posts.append(post(7, 70))
        posts.append(post(8, 80))
        p2 = paginate(posts, 3, p1["next_cursor"])
        self.assertEqual(ids(p2), [3, 2, 1])

    def test_ties_on_created_at_across_boundary(self):
        posts = [post(1, 100), post(2, 200), post(3, 200), post(4, 200), post(5, 200), post(6, 300)]
        out, _ = walk(posts, 2)
        self.assertEqual(out, [6, 5, 4, 3, 2, 1])

    def test_all_same_timestamp(self):
        posts = [post(i, 500) for i in range(1, 11)]
        out, _ = walk(posts, 3)
        self.assertEqual(out, list(range(10, 0, -1)))

    def test_exact_multiple_has_no_trailing_empty_page(self):
        posts = [post(i, i) for i in range(1, 7)]
        p1 = paginate(posts, 3)
        p2 = paginate(posts, 3, p1["next_cursor"])
        self.assertEqual(ids(p2), [3, 2, 1])
        self.assertIsNone(p2["next_cursor"])
        out, pages = walk(posts, 3)
        self.assertEqual(pages, 2)

    def test_cursor_still_works_after_referenced_post_deleted(self):
        posts = [post(i, i * 10) for i in range(1, 7)]
        p1 = paginate(posts, 3)
        posts = [p for p in posts if p["id"] != 4]
        self.assertEqual(ids(paginate(posts, 3, p1["next_cursor"])), [3, 2, 1])

    def test_empty(self):
        self.assertEqual(paginate([], 10), {"items": [], "next_cursor": None})

    def test_limit_clamped_to_100(self):
        posts = [post(i, i) for i in range(1, 251)]
        page = paginate(posts, 1000)
        self.assertEqual(len(page["items"]), 100)
        self.assertIsNotNone(page["next_cursor"])

    def test_invalid_limit(self):
        with self.assertRaises(ValueError):
            paginate([post(1, 1)], 0)
        with self.assertRaises(ValueError):
            paginate([post(1, 1)], -5)

    def test_invalid_cursor(self):
        for bad in ("%%%", "abc", "!!!!"):
            with self.assertRaises(ValueError):
                paginate([post(1, 1)], 10, bad)

    def test_large_random_walk_matches_sorted(self):
        rng = random.Random(42)
        posts = [post(i, rng.randint(0, 50)) for i in range(1, 301)]
        expected = [p["id"] for p in sorted(posts, key=lambda p: (p["created_at"], p["id"]), reverse=True)]
        for limit in (1, 7, 50, 100):
            self.assertEqual(walk(posts, limit)[0], expected)


if __name__ == "__main__":
    unittest.main()
