---
id: fe-0003
slug: feed-load-more-guard
title: 無限スクロールのフィード（多重リクエスト防止）
category: FE
tier: core
difficulty: L2
time_limit: 20
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [pagination, rate_limit]
  security: [xss]
  talk_focus: [requirements_clarify, tradeoff]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: 読み込み中フラグ（または進行中の Promise）で、読み込みが終わるまで次の要求を出さない
    weight: 3
  - id: tp2
    text: next_cursor が null になったら終端として記録し、以後は要求を出さずに「これ以上ありません」を表示する
    weight: 2
  - id: tp3
    text: ページの境目で同じ投稿が重複して返ることがあるので、表示済みの id を Set で持って重複を除く
    weight: 2
  - id: tp4
    text: 無限スクロールは IntersectionObserver で番兵要素を監視し、ボタンと同じ読み込み関数を呼ぶ形にすると、ガードが 1 か所で済む
    weight: 1
  - id: tp5
    text: 投稿タイトルは textContent で表示し、API の文字列を HTML として解釈させない
    weight: 1
requirements:
  - id: initial
    label: 開いたときに最初のページを読み込んで表示する
  - id: more
    label: 「もっと見る」で next_cursor を付けて続きを読み込む
  - id: inflight_guard
    label: 読み込み中に何度押しても同じページを重複して要求しない
  - id: end
    label: 最後のページの後は要求を出さず、「これ以上ありません」を表示する
  - id: dedupe
    label: ページをまたいで重複した投稿を 2 回表示しない
rubric_hints:
  correctness: "initial-load と load-more-guard が通れば合格ライン。end-of-feed と dedupe-across-pages は加点"
  explanation: "多重リクエストを防ぐ方法（フラグ・disabled・進行中の Promise の共有）の違いと、終端の扱いを説明できるか"
  time_management: "8 分で初回表示と続きの読み込み、15 分でガードと終端、残りで重複排除と説明"
  red_flags:
    - "読み込み中のガードが無く、連打で同じ cursor の要求が何本も飛ぶ"
    - "next_cursor が null でも「もっと見る」で要求を出し続ける"
    - "innerHTML でタイトルを描画している"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（イラスト投稿サイトのフィード画面を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

投稿のフィードを表示し、続きを読み込めるようにしてください。

- 最初のページ: `GET https://api.example.com/feed?cursor=`（cursor は空）
- 続きのページ: `GET https://api.example.com/feed?cursor=<前のレスポンスの next_cursor>`
- レスポンス: `{ "items": Array<{ id: number, title: string }>, "next_cursor": string | null }`。`next_cursor` が `null` なら最後のページです。
- ページを開いたら最初のページを表示し、「もっと見る」ボタンで続きを読み込みます。本番では画面の下端に近づいたら自動で読み込む（無限スクロール）予定ですが、今回はボタンだけで構いません。
- **サーバーがとても貧弱です。** 読み込み中にボタンを何度押されても、同じページを重複して要求しないでください。最後のページの後は要求を出さず、「これ以上ありません」と表示します。
- 新着が入るとページの境目で同じ投稿が 2 回返ることがあります。同じ id の投稿は 1 回だけ表示してください。

## 制約

テストで使うので、次の id を付けてください。

| 要素 | 指定 |
| --- | --- |
| 投稿一覧 | `<ul id="feed">`。投稿 1 件ごとに直下の `<li>` を 1 つ追加し、タイトルを表示する |
| もっと見るボタン | `<button id="more">`（最後のページの後も DOM からは消さない。非表示・無効化は可） |
| 状態表示 | `id="status"`（最後のページの後は「これ以上ありません」を含む文言） |

- レイアウト: 一覧の下に「もっと見る」ボタン。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 「貧弱なサーバー」を「同じページを 2 回取らない・終端の後は取らない」という制約に言い換えられるかを見る。
- 想定質問と答え:
  - 「読み込み中はボタンを無効化していい？」→ よい。フラグでも disabled でもよい。
  - 「失敗したら？」→ エラーを表示し、もう一度押せば同じ cursor で再試行できればよい（今回テストはしない）。
  - 「無限スクロールは実装する？」→ 任意。する場合は IntersectionObserver で、ボタンと同じ関数を呼ぶ。
- 重複排除に気づかない場合は、終了 3 分前に「2 ページ目と 3 ページ目に同じ投稿があったら？」と聞いてよい。
- 余裕があれば口頭で: 「offset 方式ではなく cursor 方式なのはなぜ？」（新着が入っても読み飛ばし・重複が起きにくい）。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. 状態は `cursor`（次に要求する値、初回は空文字）、`loading`（読み込み中か）、`done`（終端に達したか）、`seen`（表示済み id の `Set`）。
2. `loadMore()` の先頭で `if (loading || done) return;`。`loading = true` にしてから fetch し、`finally` で戻す。ボタンも `disabled` にすると押せないことが見た目でも伝わる。
3. レスポンスの `items` のうち `seen` に無いものだけ `<li>` を追加（`textContent`）。`next_cursor` を次の `cursor` にし、`null` なら `done = true` にして「これ以上ありません」を表示、ボタンを隠すか無効化する。
4. 無限スクロールにするなら、一覧の末尾に番兵要素を置き、`IntersectionObserver` で見えたら `loadMore()` を呼ぶ。ガードが `loadMore()` の中にあるので、ボタンと監視のどちらから呼ばれても多重要求にならない。

**よくある落とし穴**: `loading` を fetch の後で立てる（await の前に立てないと連打の間に複数本飛ぶ）／失敗時に `loading` を戻し忘れて二度と読み込めなくなる／`next_cursor` を `"null"` という文字列として送ってしまう。
