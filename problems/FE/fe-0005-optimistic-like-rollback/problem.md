---
id: fe-0005
slug: optimistic-like-rollback
title: いいねボタンの楽観的更新とロールバック
category: FE
tier: core
difficulty: L2
time_limit: 20
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [idempotency]
  security: [xss]
  talk_focus: [tradeoff, edge_cases]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: 押した瞬間に表示を変え（楽観的更新）、通信の結果を待たないので操作が速く感じられる
    weight: 2
  - id: tp2
    text: fetch は HTTP 503 などでは reject しないので、res.ok を見て失敗を判定する
    weight: 3
  - id: tp3
    text: 失敗したら「最後にサーバーで成功した状態」へ戻す。押す直前の状態に戻すと、連打したときに表示とサーバーがずれる
    weight: 3
  - id: tp4
    text: 連打への対処（通信中は押せなくする、最後の状態だけを送る、順に送る）のトレードオフを説明する
    weight: 1
  - id: tp5
    text: 投稿タイトルは textContent で表示し、API の文字列を HTML として解釈させない
    weight: 1
requirements:
  - id: render
    label: 投稿一覧を読み込み、いいね数といいね済みかを表示する
  - id: optimistic
    label: 押した瞬間にいいね数と表示を切り替える
  - id: request
    label: いいねは POST、取り消しは DELETE を送る
  - id: rollback
    label: 失敗したら最後に成功した状態に戻し、エラーを表示する
  - id: rapid
    label: 連打しても、最終的な表示がサーバーの状態とずれない
rubric_hints:
  correctness: "initial-render・optimistic-immediate・rollback-on-failure が通れば合格ライン。rapid-failure は加点"
  explanation: "楽観的更新の利点と、失敗時にどこへ戻すか（tp3）を説明できるか。fetch が HTTP エラーで reject しないこと（tp2）に自分から触れれば加点"
  time_management: "8 分で一覧と表示の切り替え、15 分でロールバックとエラー表示、残りで連打の扱いと説明"
  red_flags:
    - "res.ok を見ず、503 でも成功扱いにする"
    - "押す直前の状態をロールバック先にして、連打の失敗で表示がずれる"
    - "通信が終わるまで表示を変えない（楽観的更新になっていない）"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（SNS のいいねボタンを題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

投稿一覧に「いいね」ボタンを付けてください。

- ページを開いたら `GET https://api.example.com/posts` で一覧を取得します。レスポンスは `Array<{ id: number, title: string, likes: number, liked: boolean }>` です。
- いいねボタンを押すと、**通信の結果を待たずに**すぐ表示（いいね数とボタンの状態）を切り替えてください（楽観的更新）。
- いいねするときは `POST https://api.example.com/posts/<id>/like`、取り消すときは `DELETE https://api.example.com/posts/<id>/like` を送ります。成功すると HTTP 200 が返ります。
- 通信に失敗したら（HTTP 200 以外、またはネットワークエラー）、表示を**サーバーで最後に成功した状態**に戻し、「いいねできませんでした」と表示してください。
- ボタンは連打されることがあります。連打の後でも、最終的な表示がサーバーの状態とずれないようにしてください。

## 制約

テストで使うので、次の id を付けてください。

| 要素 | 指定 |
| --- | --- |
| 投稿一覧 | `id="posts"` の要素の中に、投稿ごとにタイトル・いいねボタン・いいね数を並べる |
| いいねボタン | `<button id="like-<投稿 id>">`（例: `#like-1`）。いいね済みかは `aria-pressed` などで表してよい |
| いいね数 | `id="count-<投稿 id>"`（例: `#count-1`）に数字だけを表示 |
| エラー表示 | `id="error"`（「いいねできませんでした」を含む） |

- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 楽観的更新の「戻し方」が本題。押す直前の状態に戻す実装は、1 回押しなら正しく見えるので、連打＋失敗のケースを自分で考えられるかを見る。
- 想定質問と答え:
  - 「通信中は押せなくしていい？」→ よい。ただし、押せないと遅い回線で反応が悪く感じる、というトレードオフに触れてほしい。
  - 「サーバーの返す likes で上書きする？」→ 今回のレスポンスは `{ "ok": true }` だけ。上書きできる API なら上書きが望ましい、と言えれば加点。
  - 「エラーはいつ消す？」→ 次に押したときに消せばよい。
- fetch が 503 で reject しないことを知らない受験者が多い。rollback-on-failure で落ちたら、終了後の解説で必ず扱う。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. 投稿ごとに「表示中の状態」（`liked`, `likes`）と「サーバーで確定した状態」（`confirmed`）を分けて持つ。
2. 押したら表示中の状態を反転して描画し、`liked` なら POST、そうでなければ DELETE を送る。
3. 成功したら `confirmed` をその時点の要求内容で更新する。失敗したら（`!res.ok` も含む）表示中の状態を `confirmed` に戻して描画し、エラーを表示する。
4. 連打の扱いは 3 通り: (a) 通信中は押せなくする（簡単・確実だが反応が鈍く見える） (b) 通信中の操作は覚えておき、終わったら「最後の状態」だけを送る (c) 押すたびに順に送る（要求が多い）。参照解は (b)。

**押す直前の状態に戻すと何が起きるか**: いいね（失敗）→ 取り消し（失敗）と素早く押すと、1 回目の失敗で「押す前（未いいね）」に、2 回目の失敗で「2 回目を押す前（いいね済み）」に戻り、サーバーは未いいねなのに表示はいいね済みになる。戻し先は「最後に成功した状態」にする。
