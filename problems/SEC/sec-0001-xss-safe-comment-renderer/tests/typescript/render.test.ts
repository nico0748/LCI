import test from "node:test";
import assert from "node:assert/strict";
import { renderComment } from "./render.ts";

const A_OPEN = /<a href="([^"<>]*)" rel="nofollow noopener noreferrer" target="_blank">/g;
const link = (u: string) => `<a href="${u}" rel="nofollow noopener noreferrer" target="_blank">${u}</a>`;

// 許可したタグを取り除いた残りに、タグや属性を作れる文字が残っていないこと
function assertSafe(html: string): void {
  for (const m of html.matchAll(A_OPEN)) assert.ok(/^https?:\/\//.test(m[1] ?? ""), m[1]);
  const rest = html.replace(A_OPEN, "").replaceAll("</a>", "").replaceAll("<br>", "");
  for (const ch of `<>"'`) assert.ok(!rest.includes(ch), `${ch} が残っている: ${html}`);
}

test("plain text", () => assert.equal(renderComment("すてきな絵ですね"), "すてきな絵ですね"));

test("escapes all specials", () => {
  assert.equal(renderComment(`<b>"A" & 'B'</b>`), "&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;");
});

test("does not unescape entities", () => assert.equal(renderComment("&lt;script&gt;"), "&amp;lt;script&amp;gt;"));

test("newlines", () => assert.equal(renderComment("1行目\n2行目\r\n3行目"), "1行目<br>2行目<br>3行目"));

test("linkify", () => {
  assert.equal(renderComment("見て https://example.com/a/b?x=1 です"), `見て ${link("https://example.com/a/b?x=1")} です`);
});

test("http and multiple links", () => {
  assert.equal(renderComment("http://a.example と https://b.example"), `${link("http://a.example")} と ${link("https://b.example")}`);
});

test("ampersand in URL is escaped in href", () => {
  assert.equal(renderComment("https://example.com/?a=1&b=2"), link("https://example.com/?a=1&amp;b=2"));
});

test("trailing punctuation excluded", () => {
  assert.equal(renderComment("ここ https://example.com/p."), `ここ ${link("https://example.com/p")}.`);
  assert.equal(renderComment("(https://example.com/p)"), `(${link("https://example.com/p")})`);
  assert.equal(renderComment("https://example.com/p。次"), `${link("https://example.com/p")}。次`);
});

test("URL stops at quotes and angle brackets", () => {
  let out = renderComment('https://example.com/"onmouseover="alert(1)');
  assert.ok(out.startsWith(link("https://example.com/")), out);
  assertSafe(out);
  out = renderComment("https://example.com/<script>alert(1)</script>");
  assert.ok(out.startsWith(link("https://example.com/")), out);
  assert.ok(out.includes("&lt;script&gt;"));
  assertSafe(out);
});

test("dangerous schemes are not linked", () => {
  for (const p of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"]) {
    const out = renderComment(p);
    assert.ok(!out.includes("<a "), p);
    assertSafe(out);
  }
});

test("XSS payloads are inert", () => {
  for (const p of [
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "<svg onload=alert(1)>",
    '<a href="javascript:alert(1)">x</a>',
    "' onfocus='alert(1)' autofocus='",
    "https://ok.example/ <iframe src=//evil>",
    "<<script>script>alert(1)<</script>/script>",
  ]) {
    assertSafe(renderComment(p));
  }
});

test("scheme only is not a link", () => assert.ok(!renderComment("https://").includes("<a ")));
