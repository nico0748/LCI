import unittest

from like_api import LikeApi


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


class TestLikeApi(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = FakeClock()
        self.api = LikeApi(self.clock)

    def test_first_like_is_201(self):
        status, body = self.api.like("u1", "p1", "k1")
        self.assertEqual(status, 201)
        self.assertEqual(body, {"post_id": "p1", "liked": True, "like_count": 1})

    def test_double_like_without_key_does_not_double_count(self):
        self.assertEqual(self.api.like("u1", "p1")[0], 201)
        status, body = self.api.like("u1", "p1")
        self.assertEqual(status, 200)
        self.assertEqual(body["like_count"], 1)
        self.assertEqual(self.api.count("p1"), 1)

    def test_different_keys_same_like_does_not_double_count(self):
        self.api.like("u1", "p1", "k1")
        status, body = self.api.like("u1", "p1", "k2")
        self.assertEqual(status, 200)
        self.assertEqual(self.api.count("p1"), 1)

    def test_replay_returns_saved_response_even_if_count_changed(self):
        first = self.api.like("u1", "p1", "k1")
        self.api.like("u2", "p1", "x")
        self.assertEqual(self.api.count("p1"), 2)
        replay = self.api.like("u1", "p1", "k1")
        self.assertEqual(replay, first)
        self.assertEqual(replay[0], 201)
        self.assertEqual(replay[1]["like_count"], 1)
        self.assertEqual(self.api.count("p1"), 2)

    def test_returned_body_mutation_does_not_corrupt_saved_response(self):
        _, body = self.api.like("u1", "p1", "k1")
        body["like_count"] = 999
        self.assertEqual(self.api.like("u1", "p1", "k1")[1]["like_count"], 1)

    def test_key_reused_for_other_post_is_422(self):
        self.api.like("u1", "p1", "k1")
        self.assertEqual(self.api.like("u1", "p2", "k1"), (422, {"error": "idempotency_key_reused"}))
        self.assertEqual(self.api.count("p2"), 0)

    def test_key_reused_for_other_operation_is_422(self):
        self.api.like("u1", "p1", "k1")
        self.assertEqual(self.api.unlike("u1", "p1", "k1")[0], 422)
        self.assertEqual(self.api.count("p1"), 1)

    def test_keys_are_scoped_per_user(self):
        self.assertEqual(self.api.like("u1", "p1", "same")[0], 201)
        status, body = self.api.like("u2", "p1", "same")
        self.assertEqual(status, 201)
        self.assertEqual(body["like_count"], 2)

    def test_unlike_and_not_below_zero(self):
        self.api.like("u1", "p1")
        self.assertEqual(self.api.unlike("u1", "p1"), (200, {"post_id": "p1", "liked": False, "like_count": 0}))
        self.assertEqual(self.api.unlike("u1", "p1")[1]["like_count"], 0)
        self.assertEqual(self.api.unlike("u9", "p1")[1]["like_count"], 0)
        self.assertEqual(self.api.count("p1"), 0)

    def test_like_again_after_unlike(self):
        self.api.like("u1", "p1", "a")
        self.api.unlike("u1", "p1", "b")
        self.assertEqual(self.api.like("u1", "p1", "c")[0], 201)
        self.assertEqual(self.api.count("p1"), 1)

    def test_replay_after_unlike_returns_original(self):
        first = self.api.like("u1", "p1", "k1")
        self.api.unlike("u1", "p1", "k2")
        self.assertEqual(self.api.like("u1", "p1", "k1"), first)
        self.assertEqual(self.api.count("p1"), 0)

    def test_key_expires_after_24h(self):
        self.api.like("u1", "p1", "k1")
        self.clock.t += 86400 - 1
        self.assertEqual(self.api.like("u1", "p2", "k1")[0], 422)
        self.clock.t += 2
        self.assertEqual(self.api.like("u1", "p2", "k1")[0], 201)

    def test_invalid_request_is_400_and_not_stored(self):
        self.assertEqual(self.api.like("u1", "", "k1"), (400, {"error": "invalid_request"}))
        self.assertEqual(self.api.like("", "p1", "k1"), (400, {"error": "invalid_request"}))
        self.assertEqual(self.api.like("u1", "p1", "k1")[0], 201)


if __name__ == "__main__":
    unittest.main()
