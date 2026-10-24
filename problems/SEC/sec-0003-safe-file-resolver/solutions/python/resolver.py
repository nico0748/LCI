import os


class PathError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _inside(base: str, target: str) -> bool:
    # startswith だと /srv/files と /srv/files-secret を区別できないので commonpath で比べる
    return os.path.commonpath([base, target]) == base


def resolve_user_file(base_dir: str, user_path: str) -> str:
    """user_path を base_dir 内の実ファイルに解決する。

    文字列の .. を消すのではなく、正規化した結果が内側かで判定する。
    シンボリックリンクで外に出られるので、実体（realpath）でもう一度判定する。
    """
    if not user_path or "\x00" in user_path or "\\" in user_path or user_path.startswith("/"):
        raise PathError("invalid_path")
    # 基準側も realpath（macOS の /tmp → /private/tmp のように基準自体がリンクのことがある）
    base = os.path.realpath(base_dir)
    candidate = os.path.normpath(os.path.join(base, user_path))
    # 存在確認より先に判定し、基準の外にあるファイルの有無を応答の違いで漏らさない
    if not _inside(base, candidate):
        raise PathError("outside_base")
    if not os.path.lexists(candidate):
        raise PathError("not_found")
    real = os.path.realpath(candidate)
    if not _inside(base, real):
        raise PathError("outside_base")
    if not os.path.exists(real):
        raise PathError("not_found")  # 切れたリンク
    if not os.path.isfile(real):
        raise PathError("not_a_file")
    return real
