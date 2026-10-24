import unittest

from password import check_password, hash_password, needs_rehash, verify_password

VECTOR = "pbkdf2_sha256$1000$MDEyMzQ1Njc4OWFiY2RlZg==$yqSq2SygY1sB4EcH9f2FG0JTMES+wqLsOT5YmiRBplI="
PHRASE = "correct horse battery staple"


class TestPolicy(unittest.TestCase):
    def check(self, pw, user_id="nico", email="nico.yamada@example.jp"):
        return check_password(pw, user_id, email)

    def test_ok(self):
        self.assertEqual(self.check(PHRASE), [])

    def test_no_composition_rules(self):
        self.assertEqual(self.check("abcdefghijkm"), [])
        self.assertEqual(self.check("ながいあいことばはあんぜんです"), [])
        self.assertEqual(self.check("たのしい診察室に咲く花たち"), [])

    def test_length_boundaries(self):
        self.assertEqual(self.check("a1b2c3d4e5f"), ["too_short"])
        self.assertEqual(self.check("a1b2c3d4e5f6"), [])
        self.assertEqual(self.check(("abcde" * 26)[:128]), [])
        self.assertEqual(self.check(("abcde" * 26)[:129]), ["too_long"])

    def test_length_counts_code_points(self):
        self.assertEqual(self.check("🌸" * 3 + "ab" * 4 + "x"), [])
        # 🌸 は UTF-16 では 2 単位。コードポイントで数えれば 10 文字なので短すぎる
        self.assertEqual(self.check("🌸🍀🌙abcdefg"), ["too_short"])

    def test_common(self):
        self.assertEqual(self.check("password1234"), ["common"])
        self.assertEqual(self.check("Password1234"), ["common"])
        self.assertEqual(self.check("ＰＡＳＳＷＯＲＤ１２３４"), ["common"])

    def test_common_short_reports_both_in_order(self):
        self.assertEqual(self.check("password"), ["too_short", "common"])

    def test_contains_user_info(self):
        self.assertEqual(self.check("my-NICO-is-great"), ["contains_user_info"])
        self.assertEqual(self.check("i am nico.yamada!!"), ["contains_user_info"])
        self.assertEqual(self.check("ＮＩＣＯ forever and ever"), ["contains_user_info"])

    def test_short_user_id_is_ignored(self):
        self.assertEqual(check_password("abcdefghijkm", "ab", "xy@example.com"), [])

    def test_repetitive(self):
        self.assertEqual(self.check("zzzz-bridge-river"), ["repetitive"])
        self.assertEqual(self.check("zzz-bridge-river"), [])

    def test_multiple_reasons_in_order(self):
        self.assertEqual(check_password("nicoooo", "nico", "n@x.jp"), ["too_short", "contains_user_info", "repetitive"])


class TestHash(unittest.TestCase):
    def test_vector_matches_spec_format(self):
        self.assertEqual(hash_password(PHRASE, iterations=1000, salt=b"0123456789abcdef"), VECTOR)
        self.assertTrue(verify_password(PHRASE, VECTOR))
        self.assertFalse(verify_password(PHRASE + " ", VECTOR))

    def test_random_salt_and_default_iterations(self):
        a = hash_password("ながいあいことばはあんぜんです")
        b = hash_password("ながいあいことばはあんぜんです")
        self.assertNotEqual(a, b)
        alg, it, salt, dk = a.split("$")
        self.assertEqual(alg, "pbkdf2_sha256")
        self.assertEqual(it, "600000")
        self.assertTrue(verify_password("ながいあいことばはあんぜんです", a))
        self.assertTrue(verify_password("ながいあいことばはあんぜんです", b))
        self.assertFalse(verify_password("ながいあいことばはあんぜんでした", a))

    def test_nfkc_before_hashing(self):
        stored = hash_password("ｃｏｒｒｅｃｔ horse", iterations=1000)
        self.assertTrue(verify_password("correct horse", stored))

    def test_broken_stored_values(self):
        for bad in ("", "garbage", "pbkdf2_sha256$abc$AAAA$AAAA", "md5$1000$MDEy$yqSq", "pbkdf2_sha256$1000$!!!$" + VECTOR.split("$")[3], "pbkdf2_sha256$1000$MDEyMzQ1Njc4OWFiY2RlZg==$AAAA", "pbkdf2_sha256$0$MDEyMzQ1Njc4OWFiY2RlZg==$" + VECTOR.split("$")[3], VECTOR + "$extra"):
            self.assertFalse(verify_password(PHRASE, bad), bad)

    def test_needs_rehash(self):
        self.assertTrue(needs_rehash(VECTOR))
        self.assertFalse(needs_rehash(VECTOR, iterations=1000))
        self.assertFalse(needs_rehash(VECTOR, iterations=999))
        self.assertTrue(needs_rehash("garbage"))
        self.assertTrue(needs_rehash("md5$1000$MDEy$yqSq"))


if __name__ == "__main__":
    unittest.main()
