import os
import shutil
import tempfile
import unittest

from resolver import PathError, resolve_user_file


class TestResolver(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = os.path.realpath(tempfile.mkdtemp(prefix="lci-resolver-"))
        root = os.path.join(cls.tmp, "root")
        pub = os.path.join(root, "public")
        os.makedirs(os.path.join(pub, "img"))
        os.makedirs(os.path.join(root, "public-secret"))
        os.makedirs(os.path.join(root, "secret_dir"))
        for p, body in (
            ("public/a.txt", "A"),
            ("public/img/cat.png", "PNG"),
            ("public/日本語.txt", "JA"),
            ("public/..hidden", "H"),
            ("public-secret/x.txt", "X"),
            ("secret.txt", "S"),
            ("secret_dir/s.txt", "SD"),
        ):
            with open(os.path.join(root, p), "w", encoding="utf-8") as f:
                f.write(body)
        os.symlink(os.path.join(pub, "a.txt"), os.path.join(pub, "link_in"))
        os.symlink(os.path.join(root, "secret.txt"), os.path.join(pub, "link_out"))
        os.symlink(os.path.join(root, "secret_dir"), os.path.join(pub, "dirlink_out"))
        os.symlink(os.path.join(pub, "img"), os.path.join(pub, "dirlink_in"))
        os.symlink(os.path.join(pub, "missing"), os.path.join(pub, "broken"))
        os.symlink(pub, os.path.join(cls.tmp, "baselink"))
        cls.root, cls.pub = root, pub

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def code(self, user_path, base=None):
        with self.assertRaises(PathError, msg=user_path) as cm:
            resolve_user_file(base or self.pub, user_path)
        return cm.exception.code

    def test_simple(self):
        self.assertEqual(resolve_user_file(self.pub, "a.txt"), os.path.join(self.pub, "a.txt"))
        self.assertEqual(resolve_user_file(self.pub, "img/cat.png"), os.path.join(self.pub, "img", "cat.png"))
        self.assertEqual(resolve_user_file(self.pub, "日本語.txt"), os.path.join(self.pub, "日本語.txt"))

    def test_dotdot_staying_inside(self):
        self.assertEqual(resolve_user_file(self.pub, "./img/../a.txt"), os.path.join(self.pub, "a.txt"))
        self.assertEqual(resolve_user_file(self.pub, "img//cat.png"), os.path.join(self.pub, "img", "cat.png"))

    def test_file_named_dotdot_prefix(self):
        self.assertEqual(resolve_user_file(self.pub, "..hidden"), os.path.join(self.pub, "..hidden"))

    def test_traversal(self):
        for p in ("../secret.txt", "img/../../secret.txt", "../../../../etc/passwd", "..", "../", "img/../.."):
            self.assertEqual(self.code(p), "outside_base", p)

    def test_naive_strip_bypass_is_just_a_name(self):
        # "...." はただのディレクトリ名。.. を消すだけの対策を回避する入力だが、正規化して判定すれば内側の存在しないパス
        self.assertEqual(self.code("....//....//secret.txt"), "not_found")

    def test_sibling_prefix_dir(self):
        self.assertEqual(self.code("../public-secret/x.txt"), "outside_base")

    def test_outside_nonexistent_does_not_leak(self):
        self.assertEqual(self.code("../nope.txt"), "outside_base")

    def test_invalid(self):
        for p in ("", "/etc/passwd", "a.txt\x00.png", "..\\secret.txt", "img\\cat.png"):
            self.assertEqual(self.code(p), "invalid_path", repr(p))

    def test_symlinks(self):
        self.assertEqual(resolve_user_file(self.pub, "link_in"), os.path.join(self.pub, "a.txt"))
        self.assertEqual(resolve_user_file(self.pub, "dirlink_in/cat.png"), os.path.join(self.pub, "img", "cat.png"))
        self.assertEqual(self.code("link_out"), "outside_base")
        self.assertEqual(self.code("dirlink_out/s.txt"), "outside_base")

    def test_not_found_and_not_a_file(self):
        self.assertEqual(self.code("nope.txt"), "not_found")
        self.assertEqual(self.code("broken"), "not_found")
        self.assertEqual(self.code("img"), "not_a_file")
        self.assertEqual(self.code("."), "not_a_file")

    def test_no_double_decoding(self):
        self.assertEqual(self.code("%2e%2e/secret.txt"), "not_found")

    def test_base_dir_is_symlink(self):
        base = os.path.join(self.tmp, "baselink")
        self.assertEqual(resolve_user_file(base, "a.txt"), os.path.join(self.pub, "a.txt"))
        self.assertEqual(self.code("../secret.txt", base=base), "outside_base")


if __name__ == "__main__":
    unittest.main()
