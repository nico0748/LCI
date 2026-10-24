import base64
import binascii
import json

MAX_LIMIT = 100


def _encode(created_at: int, post_id: int) -> str:
    raw = json.dumps({"c": created_at, "i": post_id}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode(cursor: str) -> tuple[int, int]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        c, i = data["c"], data["i"]
    except (binascii.Error, ValueError, KeyError, TypeError, UnicodeDecodeError) as e:
        raise ValueError("invalid_cursor") from e
    if not isinstance(c, int) or not isinstance(i, int) or isinstance(c, bool) or isinstance(i, bool):
        raise ValueError("invalid_cursor")
    return c, i


def paginate(posts: list[dict], limit: int, cursor: str | None = None) -> dict:
    """新しい順（created_at 降順、同時刻は id 降順）に limit 件と next_cursor を返す。

    カーソルは最後に返した投稿の (created_at, id)。添字ではなく値で比較するので、
    先頭に新着が入ってもページがずれず、カーソルが指す投稿が消えても続きを取れる。
    """
    if not isinstance(limit, int) or limit < 1:
        raise ValueError("limit は 1 以上")
    limit = min(limit, MAX_LIMIT)
    ordered = sorted(posts, key=lambda p: (p["created_at"], p["id"]), reverse=True)
    if cursor is not None:
        boundary = _decode(cursor)
        ordered = [p for p in ordered if (p["created_at"], p["id"]) < boundary]
    # limit + 1 件見て「次があるか」を判定する（ちょうど最後のページで空ページへのカーソルを返さない）
    window = ordered[: limit + 1]
    items = window[:limit]
    next_cursor = None
    if len(window) > limit:
        last = items[-1]
        next_cursor = _encode(last["created_at"], last["id"])
    return {"items": items, "next_cursor": next_cursor}
