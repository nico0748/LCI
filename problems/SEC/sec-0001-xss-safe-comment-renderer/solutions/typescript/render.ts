// URL は ASCII の RFC 3986 文字だけ。空白・山括弧・引用符（' 以外）・非 ASCII で止まる
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;
const TRAILING = /[.,!?)]+$/;

// & を最初に置換しないと、後で作った &lt; などが &amp;lt; に化ける
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function text(s: string): string {
  return escapeHtml(s).replace(/\r\n/g, "\n").replace(/\n/g, "<br>");
}

// URL を先に切り出し、テキスト部分と URL 部分をそれぞれエスケープしてから組み立てる。
// リンクにするのは http/https の許可リストだけ。
export function renderComment(input: string): string {
  const out: string[] = [];
  let pos = 0;
  for (const m of input.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = m[0].replace(TRAILING, "");
    if (url.endsWith("://")) continue;
    out.push(text(input.slice(pos, start)));
    const u = escapeHtml(url);
    out.push(`<a href="${u}" rel="nofollow noopener noreferrer" target="_blank">${u}</a>`);
    pos = start + url.length;
  }
  out.push(text(input.slice(pos)));
  return out.join("");
}
