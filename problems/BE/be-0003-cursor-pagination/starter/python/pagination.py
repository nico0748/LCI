def paginate(posts: list[dict], limit: int, cursor: str | None = None) -> dict:
    """新しい順に limit 件と next_cursor を返す。"""
    raise NotImplementedError
