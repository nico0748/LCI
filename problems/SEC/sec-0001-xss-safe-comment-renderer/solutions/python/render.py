import re

# URL は ASCII の RFC 3986 文字だけ。空白・引用符以外の記号・山括弧・非 ASCII で止まる
_URL = re.compile(r"https?://[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+")
_TRAILING = ".,!?)"


def _escape(s: str) -> str:
    # & を最初に置換しないと、後で作った &lt; などが &amp;lt; に化ける
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _text(s: str) -> str:
    return _escape(s).replace("\r\n", "\n").replace("\n", "<br>")


def render_comment(text: str) -> str:
    """URL を先に切り出し、テキスト部分と URL 部分をそれぞれエスケープしてから組み立てる。

    リンクにするのは http/https の許可リストだけ（javascript: などを禁止リストで弾こうとしない）。
    """
    out: list[str] = []
    pos = 0
    for m in _URL.finditer(text):
        url = m.group(0).rstrip(_TRAILING)
        if url.endswith("://"):
            continue  # "https://." のようにホスト部が空になったものはリンクにしない
        out.append(_text(text[pos : m.start()]))
        u = _escape(url)
        out.append(f'<a href="{u}" rel="nofollow noopener noreferrer" target="_blank">{u}</a>')
        pos = m.start() + len(url)
    out.append(_text(text[pos:]))
    return "".join(out)
