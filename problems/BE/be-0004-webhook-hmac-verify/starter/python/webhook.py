class WebhookError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def verify_webhook(raw_body: bytes, header: str, secrets: list[str], now: int) -> dict:
    raise NotImplementedError
