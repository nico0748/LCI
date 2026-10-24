import unittest

from rate_limiter import RateLimiter


class TestRateLimiter(unittest.TestCase):
    def test_burst_up_to_capacity(self):
        rl = RateLimiter(3, 1)
        self.assertEqual([rl.allow("u1", 0.0) for _ in range(4)], [True, True, True, False])

    def test_refill_over_time(self):
        rl = RateLimiter(3, 1)
        for _ in range(3):
            rl.allow("u1", 0.0)
        self.assertFalse(rl.allow("u1", 0.5))
        self.assertTrue(rl.allow("u1", 1.0))
        self.assertFalse(rl.allow("u1", 1.0))

    def test_refill_is_capped(self):
        rl = RateLimiter(3, 1)
        rl.allow("u1", 0.0)
        results = [rl.allow("u1", 100.0) for _ in range(4)]
        self.assertEqual(results, [True, True, True, False])

    def test_keys_are_independent(self):
        rl = RateLimiter(1, 1)
        self.assertTrue(rl.allow("a", 0.0))
        self.assertFalse(rl.allow("a", 0.0))
        self.assertTrue(rl.allow("b", 0.0))

    def test_fractional_refill(self):
        rl = RateLimiter(1, 0.5)
        self.assertTrue(rl.allow("u", 0.0))
        self.assertFalse(rl.allow("u", 1.0))
        self.assertTrue(rl.allow("u", 2.0))

    def test_denied_call_does_not_consume(self):
        rl = RateLimiter(1, 1)
        self.assertTrue(rl.allow("u", 0.0))
        for t in (0.1, 0.2, 0.3):
            self.assertFalse(rl.allow("u", t))
        self.assertTrue(rl.allow("u", 1.0))

    def test_retry_after(self):
        rl = RateLimiter(1, 0.5)
        self.assertAlmostEqual(rl.retry_after("u", 0.0), 0.0)
        self.assertTrue(rl.allow("u", 0.0))
        self.assertAlmostEqual(rl.retry_after("u", 0.0), 2.0)
        self.assertAlmostEqual(rl.retry_after("u", 1.5), 0.5)
        self.assertAlmostEqual(rl.retry_after("u", 2.0), 0.0)
        self.assertTrue(rl.allow("u", 2.0))

    def test_retry_after_does_not_consume(self):
        rl = RateLimiter(2, 1)
        rl.retry_after("u", 0.0)
        rl.retry_after("u", 0.0)
        self.assertTrue(rl.allow("u", 0.0))
        self.assertTrue(rl.allow("u", 0.0))

    def test_clock_going_backwards(self):
        rl = RateLimiter(2, 1)
        self.assertTrue(rl.allow("u", 10.0))
        self.assertTrue(rl.allow("u", 10.0))
        self.assertFalse(rl.allow("u", 5.0))
        self.assertFalse(rl.allow("u", 10.5))
        self.assertTrue(rl.allow("u", 11.0))
        self.assertFalse(rl.allow("u", 11.0))

    def test_invalid_config(self):
        for cap, refill in ((0, 1), (-1, 1), (1, 0), (1, -2)):
            with self.assertRaises(ValueError):
                RateLimiter(cap, refill)


if __name__ == "__main__":
    unittest.main()
