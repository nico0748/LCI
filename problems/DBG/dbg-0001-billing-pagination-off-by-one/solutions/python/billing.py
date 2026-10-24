from datetime import date


def paginate(items: list, page: int, per_page: int = 20) -> dict:
    """請求明細を 1 始まりのページに分ける。

    - total_pages: 全明細を per_page 件ずつ表示するのに必要なページ数。明細が 0 件でも 1。
    - page が 1 未満、または total_pages より大きい場合は ValueError。
    - items: そのページに表示する明細（最大 per_page 件）。
    - has_next: 次のページがあるか。
    """
    # 切り捨てでは端数のページが消える（41 件で 2 ページになる）。切り上げ、かつ 0 件でも 1 ページ
    total_pages = max(1, (len(items) + per_page - 1) // per_page)
    if page < 1 or page > total_pages:
        raise ValueError(f"page は 1〜{total_pages}")
    # page は 1 始まり。スライスの終端は排他的なので - 1 しない
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "items": items[start:end],
        "page": page,
        "total_pages": total_pages,
        "has_next": page < total_pages,
    }


def items_in_period(items: list[dict], start: date, end: date) -> list[dict]:
    """請求日 billed_on が start 以上 end 以下（両端を含む）の明細を、元の順番のまま返す。"""
    return [i for i in items if start <= i["billed_on"] <= end]
