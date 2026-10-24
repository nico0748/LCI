---
id: sec-0001
slug: xss-safe-comment-renderer
title: コメント本文の XSS 安全なレンダリング
category: SEC
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [pixiv]
  nfr: [validation]
  security: [xss]
  talk_focus: [requirements_clarify, failure_mode, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: render.py
    language: python
    content_ref: starter/python/render.py
  - path: render.ts
    language: typescript
    content_ref: starter/typescript/render.ts
talking_points:
  - id: tp1
    text: 先に URL を切り出し、テキスト部分と URL 部分をそれぞれ HTML エスケープしてから a 要素を組み立てる
    weight: 3
  - id: tp2
    text: エスケープは & を最初に置換し、属性値に入るので " と ' も &quot; &#39; にする
    weight: 2
  - id: tp3
    text: 'リンクにするのは http:// と https:// の許可リストだけで、javascript: や data: は禁止リストでなく許可リストで防ぐ'
    weight: 3
  - id: tp4
    text: 外部リンクには rel="nofollow noopener noreferrer" を付け、target=_blank による window.opener の悪用を防ぐ
    weight: 1
  - id: tp5
    text: URL の末尾の句読点や閉じ括弧をリンクに含めないなど、自動リンクの境界の決め方を説明する
    weight: 1
requirements:
  - id: escape
    label: 本文中の HTML 特殊文字は文字として表示され、タグや属性として解釈されない
  - id: newline
    label: 改行は改行として表示される
  - id: linkify
    label: http/https の URL だけがクリックできるリンクになり、他のスキームはリンクにならない
  - id: attr_safe
    label: URL に引用符や山括弧が含まれていても属性から抜け出せない
  - id: link_attrs
    label: 外部リンクは新しいタブで開き、遷移先にリファラや opener を渡さない
rubric_hints:
  correctness: "XSS ペイロードのテストが全部通ることが最低ライン。リンク化の細部（末尾の句読点）は加点"
  explanation: "tp1 の『どの順で処理するか（切り出し→エスケープ→組み立て）』を最初に宣言できたか。禁止リストではなく許可リストと言えれば加点"
  time_management: "10 分時点でエスケープと改行が動いていること"
  red_flags:
    - "エスケープ前の文字列に対して正規表現でタグを差し込み、後から全体を置換している（a 要素ごと壊れる、または二重エスケープ）"
    - "& を最後に置換して &lt; が &amp;lt; になる"
    - "javascript: を文字列検索で弾くだけ（大文字小文字・空白・実体参照で回避される）"
    - "ブラウザ側で innerHTML に入れる前提なのに「サーバーでサニタイズ済みだから大丈夫」とだけ言う"
  checklist: []
reference_solutions:
  python: solutions/python/render.py
  typescript: solutions/typescript/render.ts
source:
  origin: "04 §2.2 SEC 代表例（XSS 安全な描画）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "IDN（非 ASCII ドメイン）の URL はリンク化しない仕様にしている。実サービスでは punycode 表示の検討が要る"
---

## 問題文

イラストへのコメント欄で、本文を HTML に変換する関数を作ってください。ユーザーはプレーンテキストで書きます。

- 改行はそのまま改行として表示したいです。
- 本文中の `http://` または `https://` で始まる URL はリンクにしてください。
- 返した HTML はそのままページに埋め込まれます。悪意のある投稿で、スクリプトが動いたり、別のサイトに飛ばされたりしないようにしてください。

`render_comment(text)` が HTML 文字列を返します。何を信用していないのかを説明しながら書いてください。

## 制約

- Python: `render_comment(text: str) -> str`（`render.py`）。TypeScript: `renderComment(text: string): string`（`render.ts`）。標準ライブラリのみ（`html.escape` は使ってよい）。
- 出力に現れてよいタグは `<br>` と `<a href="…" rel="nofollow noopener noreferrer" target="_blank">…</a>` だけ（属性はこの順・この書式）。
- エスケープ: `&`→`&amp;`、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;`。改行（`\n`、`\r\n`）は `<br>`。
- URL は `http://` か `https://` で始まり、ASCII の英数字と `-._~:/?#[]@!$&'()*+,;=%` が続く部分。末尾の `.` `,` `!` `?` `)` はリンクに含めない。リンクの表示文字列は URL と同じ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初の 1 分で「入力は全部信用しない」「出力先は HTML の本文と属性の 2 つの文脈」を言えるかを見る。
- 想定質問と答え:
  - 「先にエスケープしてからリンク化しては？」→ できるが、エスケープ済みの `&amp;` を URL として扱うことになり境界が分かりにくい。切り出してから部分ごとにエスケープする方が説明しやすい。
  - 「javascript: はどう弾く？」→ 弾くのではなく http/https だけを許す。
  - 「`"` をエスケープしないと？」→ href 属性から抜けて `onmouseover=` を足される。
  - 「target=_blank の注意は？」→ noopener を付けないと遷移先が window.opener で元タブを書き換えられる。
  - 「ブラウザ側では？」→ この HTML を入れる箇所以外は textContent。CSP も併用。
- ヒントの出し順: (1) 「`<script>` と書かれたコメントはどう表示されるべきですか」 (2) 「URL に `"` が入っていたら、href はどこで終わりますか」 (3) 「`JaVaScRiPt:` は？」

## 振り返り用解説（終了後のみ表示）

**想定解答**: 正規表現 `https?://[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+` で URL を探し、マッチの末尾から `.,!?)` を取り除いて URL を確定する。URL の前のテキストはエスケープ、URL は `href` と表示の両方でエスケープして `<a …>` を組み立てる。最後の残りもエスケープ。改行は、エスケープ後のテキストで `\r\n` と `\n` を `<br>` に置き換える（URL は空白・改行を含まないので影響しない）。

**別解 A: 先に全体をエスケープしてからリンク化する**。エスケープ後の文字列に URL 用の正規表現を当てる。`&` は `&amp;` になって URL の文字集合に含まれるので結果は同じになる。ただし「どの文字列がエスケープ済みか」を頭の中で追う必要があり、href を作るときに二重エスケープしやすい。テストで `?a=1&b=2` の出力を確認すること。

**別解 B: DOM で組み立てる（ブラウザ側で描画する場合）**。サーバーは文字列のまま返し、ブラウザで `document.createTextNode` と `document.createElement("a")` で組み立て、`a.href` には `new URL(u)` で解析した結果の `protocol` が `http:` / `https:` のものだけを入れる。エスケープ関数を自作しなくて済むのが最大の利点で、innerHTML を使わない限り XSS の余地がほぼ無い。
