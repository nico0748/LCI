import hashlib
import hmac
import json

TOLERANCE_SEC = 300


class WebhookError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _parse_header(header: str) -> tuple[int, list[str]]:
    t: int | None = None
    sigs: list[str] = []
    for part in header.split(","):
        k, sep, v = part.strip().partition("=")
        if not sep:
            continue
        if k == "t":
            if t is not None or not v.isdigit():
                raise WebhookError("malformed_header")
            t = int(v)
        elif k == "v1":
            sigs.append(v.lower())
        # v0 など未知の項目は無視する（将来の方式追加に備える）
    if t is None or not sigs:
        raise WebhookError("malformed_header")
    return t, sigs


def verify_webhook(raw_body: bytes, header: str, secrets: list[str], now: int) -> dict:
    """署名とタイムスタンプを検証し、イベント（JSON）を返す。

    - 署名対象は "{t}." + 生のボディ。パースし直した JSON では空白やキー順が変わって一致しない
    - t を署名に含めることで、古い要求の t だけ書き換える再送を防ぐ
    - 比較は compare_digest（定数時間）
    """
    t, sigs = _parse_header(header)
    if abs(now - t) > TOLERANCE_SEC:
        raise WebhookError("timestamp_out_of_range")
    signed = f"{t}.".encode() + raw_body
    ok = False
    for secret in secrets:
        expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        for s in sigs:
            # 早期 return しないことで、何個目で一致したかが時間に出ないようにする
            ok |= hmac.compare_digest(expected, s)
    if not ok:
        raise WebhookError("signature_mismatch")
    try:
        return json.loads(raw_body)
    except (ValueError, UnicodeDecodeError) as e:
        raise WebhookError("invalid_payload") from e
