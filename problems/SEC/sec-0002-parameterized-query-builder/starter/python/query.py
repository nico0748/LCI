def build_post_search(filters: dict, sort: str = "-created_at", limit: int = 20) -> tuple[str, list]:
    """検索条件から (sql, params) を作る。"""
    raise NotImplementedError
