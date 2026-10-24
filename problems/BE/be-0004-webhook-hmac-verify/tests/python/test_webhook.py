import hashlib
import hmac
import unittest

from webhook import WebhookError, verify_webhook

SECRET = "whsec_test_123"
NOW = 1_730_000_000
BODY = b'{"id":"evt_1","type":"payment.succeeded","amount":1200}'


def sign(t: int, body: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()


class TestWebhook(unittest.TestCase):
    def assertCode(self, code, *args):
        with self.assertRaises(WebhookError) as cm:
            verify_webhook(*args)
        self.assertEqual(cm.exception.code, code)

    def test_valid(self):
        header = f"t={NOW},v1={sign(NOW, BODY)}"
        event = verify_webhook(BODY, header, [SECRET], NOW)
        self.assertEqual(event["id"], "evt_1")
        self.assertEqual(event["amount"], 1200)

    def test_header_with_spaces_and_unknown_scheme(self):
        header = f"t={NOW}, v0=deadbeef, v1={sign(NOW, BODY)}"
        self.assertEqual(verify_webhook(BODY, header, [SECRET], NOW)["id"], "evt_1")

    def test_tampered_body(self):
        header = f"t={NOW},v1={sign(NOW, BODY)}"
        self.assertCode("signature_mismatch", BODY.replace(b"1200", b"9999"), header, [SECRET], NOW)

    def test_reserialized_json_does_not_match(self):
        header = f"t={NOW},v1={sign(NOW, BODY)}"
        pretty = b'{"id": "evt_1", "type": "payment.succeeded", "amount": 1200}'
        self.assertCode("signature_mismatch", pretty, header, [SECRET], NOW)

    def test_signature_over_body_only_is_rejected(self):
        body_only = hmac.new(SECRET.encode(), BODY, hashlib.sha256).hexdigest()
        self.assertCode("signature_mismatch", BODY, f"t={NOW},v1={body_only}", [SECRET], NOW)

    def test_wrong_secret(self):
        header = f"t={NOW},v1={sign(NOW, BODY, 'other')}"
        self.assertCode("signature_mismatch", BODY, header, [SECRET], NOW)

    def test_timestamp_changed_breaks_signature(self):
        old = NOW - 3600
        header = f"t={NOW},v1={sign(old, BODY)}"
        self.assertCode("signature_mismatch", BODY, header, [SECRET], NOW)

    def test_tolerance_boundaries(self):
        for t in (NOW - 300, NOW + 300):
            self.assertEqual(verify_webhook(BODY, f"t={t},v1={sign(t, BODY)}", [SECRET], NOW)["id"], "evt_1")
        for t in (NOW - 301, NOW + 301, NOW - 86400):
            self.assertCode("timestamp_out_of_range", BODY, f"t={t},v1={sign(t, BODY)}", [SECRET], NOW)

    def test_rotation_multiple_signatures(self):
        header = f"t={NOW},v1={sign(NOW, BODY, 'old')},v1={sign(NOW, BODY, 'new')}"
        self.assertEqual(verify_webhook(BODY, header, ["new"], NOW)["id"], "evt_1")
        self.assertEqual(verify_webhook(BODY, header, ["old"], NOW)["id"], "evt_1")

    def test_rotation_multiple_secrets(self):
        header = f"t={NOW},v1={sign(NOW, BODY, 'old')}"
        self.assertEqual(verify_webhook(BODY, header, ["new", "old"], NOW)["id"], "evt_1")
        self.assertCode("signature_mismatch", BODY, header, ["new"], NOW)

    def test_malformed_headers(self):
        good = sign(NOW, BODY)
        for header in ("", "garbage", f"v1={good}", f"t={NOW}", f"t=abc,v1={good}", f"t=-5,v1={good}", f"t={NOW},v0={good}"):
            self.assertCode("malformed_header", BODY, header, [SECRET], NOW)

    def test_invalid_payload(self):
        body = b"not json"
        self.assertCode("invalid_payload", body, f"t={NOW},v1={sign(NOW, body)}", [SECRET], NOW)

    def test_non_ascii_body(self):
        body = '{"id":"evt_2","note":"決済完了"}'.encode("utf-8")
        self.assertEqual(verify_webhook(body, f"t={NOW},v1={sign(NOW, body)}", [SECRET], NOW)["note"], "決済完了")


if __name__ == "__main__":
    unittest.main()
