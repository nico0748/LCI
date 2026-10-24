---
id: fe-0004
slug: signup-async-validation
title: 会員登録フォームの非同期バリデーション
category: FE
tier: core
difficulty: L3
time_limit: 30
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [validation, debounce, abort]
  security: []
  talk_focus: [requirements_clarify, tradeoff, edge_cases]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: 形式チェックは手元で先に行い、形式が正しくない名前ではサーバーに問い合わせない
    weight: 2
  - id: tp2
    text: 入力のたびに問い合わせず、debounce で入力が止まってから 1 回だけ問い合わせる
    weight: 3
  - id: tp3
    text: 前の問い合わせは AbortController で中断するか、応答がどの値に対するものかを確かめて、古い結果で表示を上書きしない
    weight: 3
  - id: tp4
    text: 「使用できる」は確認した時点の値に対する結果なので、入力が変わったら状態を未確認に戻し、送信の可否もそれで判断する
    weight: 2
  - id: tp5
    text: 確認と登録の間に他の人が同じ名前を取ることがあるので、最終的な重複チェックはサーバーの登録 API 側でも必要（409 などで返る）
    weight: 1
  - id: tp6
    text: 送信中はボタンを無効化して二重登録を防ぐ
    weight: 1
requirements:
  - id: format
    label: ユーザー名とメールアドレスの形式を手元で検査し、形式が正しくない名前は問い合わせない
  - id: debounce
    label: ユーザー名の入力が止まってから重複確認を問い合わせる
  - id: stale
    label: 古い確認結果で表示を上書きしない
  - id: gate
    label: 今の入力値が「使用できる」と確認できるまで送信しない
  - id: double_submit
    label: 送信を連打しても登録を重複して送らない
  - id: feedback
    label: 各状態（形式エラー・確認中・使用できる・使われている）を表示する
rubric_hints:
  correctness: "format-check-no-request・debounce-typing・blocked-when-invalid が通れば合格ライン。stale-response と stale-availability は加点"
  explanation: "debounce と中断（または応答の照合）がそれぞれ何を防ぐかを分けて説明できるか。tp5 のサーバー側の再チェックに触れれば加点"
  time_management: "10 分で形式チェックと問い合わせ、20 分で debounce・中断・送信の制御、残りで説明"
  red_flags:
    - "input イベントごとに問い合わせを送る"
    - "遅れて届いた古い応答で「使用できます」と表示してしまう"
    - "一度「使用できます」になったら、名前を変えても送信できてしまう"
    - "クライアントの重複確認だけで一意性を保証できると考えている"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（Web サービスの会員登録画面を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

会員登録フォームを作ってください。ユーザー名・メールアドレスの入力欄と、登録ボタンがあります。

- ユーザー名は **3〜16 文字の半角英小文字・数字・`_`** です。形式が正しければ、`GET https://api.example.com/users/available?name=<ユーザー名>` で使用できるか確認します。レスポンスは `{ "available": boolean }` です。
- メールアドレスは `xxx@yyy.zz` の形（`@` の前後が空でなく、`@` の後ろに `.` がある）なら正しいとします。
- 登録ボタンを押すと `POST https://api.example.com/signup` に `{ "username": string, "email": string }` の JSON を送ります。**今入力されているユーザー名が「使用できる」と確認できていて、メールアドレスの形式も正しいときだけ**送ります。
- **サーバーがとても貧弱です。** ユーザー名を 1 文字打つたびに問い合わせないでください（入力が止まってから問い合わせる）。また、遅れて届いた古い確認結果で表示を上書きしないでください。
- 登録の連打で同じ登録を何度も送らないでください。

## 制約

テストで使うので、次の id と文言を使ってください。

| 要素 | 指定 |
| --- | --- |
| ユーザー名 | `<input id="username">`、状態は `id="username-msg"` |
| メールアドレス | `<input id="email">`、状態は `id="email-msg"` |
| 登録ボタン | `<button id="submit">` |
| 登録結果 | `id="result"`（成功時は「登録しました」を含む） |

`#username-msg` の文言: 形式エラーは「形式が正しくありません」、確認中は「確認中」、使える場合は「使用できます」、使われている場合は「使われています」をそれぞれ含めてください。`#email-msg` の形式エラーは「メールアドレスの形式が正しくありません」を含めてください。

- 確認中に登録ボタンが押されたときは、送らずに待ってもらう表示をする（確認後に自動で送る必要はない）か、ボタンを無効化しておく。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 「貧弱なサーバー」から、①形式が悪いものは送らない ②debounce ③古いものは中断／無視、の 3 段に分けて話せるかを見る。
- 想定質問と答え:
  - 「debounce の時間は？」→ 任せる（250〜500ms が目安）。理由を言えれば加点。
  - 「中断と、応答を無視するのはどちらがいい？」→ どちらでもよい。中断はサーバー側の処理まで止まるとは限らない、無視は通信量が減らない、というトレードオフを言えれば加点。
  - 「確認中に送信されたら？」→ 送らない。待ってもらう表示か disabled でよい。
  - 「確認済みでも登録で重複したら？」→ 登録 API が 409 を返す想定。今回はテストしないが、tp5 に触れれば加点。
- 「使用できます」の状態を、名前を変えた後も持ち越していないか（stale-availability）を必ず確認する。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. ユーザー名の状態を `{ value, state }`（`state` は `invalid` / `checking` / `available` / `taken` / `error`）で持つ。入力のたびに `value` を更新し、`state` を一旦 `checking`（形式エラーなら `invalid`）に戻す。これで「前の名前で使用できると分かった」状態が持ち越されない。
2. 形式が正しいときだけ、debounce（例: 300ms）の後に問い合わせる。新しい入力が来たらタイマーを消し、進行中の問い合わせは `AbortController` で中断する。
3. 応答が来たら、その応答がどの値に対するものかを確かめ、今の `value` と違えば捨てる（中断し損ねた場合の保険）。
4. 送信は `state === "available"` かつメール形式が正しいときだけ。送信中はボタンを `disabled` にし、成功後も再送できないようにする。
5. クライアントの確認は体験を良くするためのもので、一意性は保証しない。最終的には登録 API が重複を検出して 409 を返し、画面はそれを表示する。

**debounce と中断の役割の違い**: debounce は「送る数」を減らし、中断（または照合）は「古い結果を表示しない」ためのもの。どちらか一方では足りない。debounce だけだと、遅い応答の後に打った名前の応答が先に届いた場合に古い結果で上書きされうる。
