class PathError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def resolve_user_file(base_dir: str, user_path: str) -> str:
    raise NotImplementedError
