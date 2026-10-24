COLUMNS = "id, author_id, title, status, created_at, like_count"
STATUSES = {"draft", "published", "archived"}
# 識別子（列名・向き）はプレースホルダにできないので、許可リストの対応表から SQL 断片を選ぶ
SORTS = {
    "created_at": "created_at ASC, id DESC",
    "-created_at": "created_at DESC, id DESC",
    "like_count": "like_count ASC, id DESC",
    "-like_count": "like_count DESC, id DESC",
    "id": "id ASC",
    "-id": "id DESC",
}
MAX_IDS = 100


def _int(name: str, v: object) -> int:
    # bool は int の派生型なので明示的に除く
    if not isinstance(v, int) or isinstance(v, bool):
        raise ValueError(f"{name} は整数")
    return v


def _like_literal(s: str) -> str:
    # \ を最初にエスケープしないと、後で足した \% の \ が二重に解釈される
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_post_search(filters: dict, sort: str = "-created_at", limit: int = 20) -> tuple[str, list]:
    """検索条件から (sql, params) を作る。値は必ず params に入れ、SQL 文字列には固定の断片しか入れない。"""
    where: list[str] = []
    params: list = []
    for key, v in filters.items():
        if key == "author_id":
            where.append("author_id = ?")
            params.append(_int(key, v))
        elif key == "status":
            if v not in STATUSES:
                raise ValueError("status が不正")
            where.append("status = ?")
            params.append(v)
        elif key == "title_contains":
            if not isinstance(v, str):
                raise ValueError("title_contains は文字列")
            where.append("title LIKE ? ESCAPE '\\'")
            params.append(f"%{_like_literal(v)}%")
        elif key == "created_from":
            where.append("created_at >= ?")
            params.append(_int(key, v))
        elif key == "created_to":
            where.append("created_at <= ?")
            params.append(_int(key, v))
        elif key == "ids":
            if not isinstance(v, list) or len(v) > MAX_IDS:
                raise ValueError(f"ids は {MAX_IDS} 件以下の配列")
            ids = [_int(key, x) for x in v]
            if not ids:
                where.append("1 = 0")
            else:
                where.append(f"id IN ({', '.join('?' for _ in ids)})")
                params.extend(ids)
        else:
            raise ValueError(f"未知の条件: {key!r}")
    order = SORTS.get(sort) if isinstance(sort, str) else None
    if order is None:
        raise ValueError("sort が不正")
    if _int("limit", limit) < 1 or limit > 100:
        raise ValueError("limit は 1〜100")
    sql = f"SELECT {COLUMNS} FROM posts"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {order} LIMIT ?"
    params.append(limit)
    return sql, params
