import re
import unittest

from render import render_comment

A_OPEN = re.compile(r'<a href="([^"<>]*)" rel="nofollow noopener noreferrer" target="_blank">')


def link(url_escaped: str) -> str:
    return f'<a href="{url_escaped}" rel="nofollow noopener noreferrer" target="_blank">{url_escaped}</a>'


def assert_safe(tc: unittest.TestCase, html: str) -> None:
    """許可したタグを取り除いた残りに、タグや属性を作れる文字が残っていないこと"""
    for href in A_OPEN.findall(html):
        tc.assertTrue(href.startswith("http://") or href.startswith("https://"), href)
    rest = A_OPEN.sub("", html).replace("</a>", "").replace("<br>", "")
    for ch in "<>\"'":
        tc.assertNotIn(ch, rest, f"{ch!r} が残っている: {html}")


class TestRender(unittest.TestCase):
    def test_plain_text(self):
        self.assertEqual(render_comment("すてきな絵ですね"), "すてきな絵ですね")

    def test_escape_all_specials(self):
        self.assertEqual(render_comment("""<b>"A" & 'B'</b>"""), "&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;")

    def test_no_double_unescape(self):
        self.assertEqual(render_comment("&lt;script&gt;"), "&amp;lt;script&amp;gt;")

    def test_newlines(self):
        self.assertEqual(render_comment("1行目\n2行目\r\n3行目"), "1行目<br>2行目<br>3行目")

    def test_linkify(self):
        self.assertEqual(render_comment("見て https://example.com/a/b?x=1 です"), "見て " + link("https://example.com/a/b?x=1") + " です")

    def test_linkify_http_and_multiple(self):
        out = render_comment("http://a.example と https://b.example")
        self.assertEqual(out, link("http://a.example") + " と " + link("https://b.example"))

    def test_ampersand_in_url_is_escaped_in_href(self):
        self.assertEqual(render_comment("https://example.com/?a=1&b=2"), link("https://example.com/?a=1&amp;b=2"))

    def test_trailing_punctuation_excluded(self):
        self.assertEqual(render_comment("ここ https://example.com/p."), "ここ " + link("https://example.com/p") + ".")
        self.assertEqual(render_comment("(https://example.com/p)"), "(" + link("https://example.com/p") + ")")
        self.assertEqual(render_comment("https://example.com/p。次"), link("https://example.com/p") + "。次")

    def test_url_stops_at_quote_and_angle(self):
        out = render_comment('https://example.com/"onmouseover="alert(1)')
        self.assertTrue(out.startswith(link("https://example.com/")), out)
        assert_safe(self, out)
        out = render_comment("https://example.com/<script>alert(1)</script>")
        self.assertTrue(out.startswith(link("https://example.com/")), out)
        self.assertIn("&lt;script&gt;", out)
        assert_safe(self, out)

    def test_dangerous_schemes_not_linked(self):
        for payload in ("javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"):
            out = render_comment(payload)
            self.assertNotIn("<a ", out, payload)
            assert_safe(self, out)

    def test_xss_payloads_are_inert(self):
        payloads = [
            "<script>alert(1)</script>",
            '"><img src=x onerror=alert(1)>',
            "<svg onload=alert(1)>",
            "<a href=\"javascript:alert(1)\">x</a>",
            "' onfocus='alert(1)' autofocus='",
            "https://ok.example/ <iframe src=//evil>",
            "<<script>script>alert(1)<</script>/script>",
        ]
        for p in payloads:
            assert_safe(self, render_comment(p))

    def test_scheme_only_is_not_link(self):
        self.assertNotIn("<a ", render_comment("https://"))


if __name__ == "__main__":
    unittest.main()
