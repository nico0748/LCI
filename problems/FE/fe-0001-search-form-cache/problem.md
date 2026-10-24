---
id: fe-0001
slug: search-form-cache
title: 検索フォームとサーバーに優しいキャッシュ
category: FE
tier: core
difficulty: L2
time_limit: 20
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [cache, abort]
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
    text: 空クエリはリクエストを送らない
    weight: 2
  - id: tp2
    text: 同一クエリはキャッシュ Map から返し TTL で鮮度を担保する
    weight: 3
  - id: tp3
    text: 古いリクエストを AbortController で中断する
    weight: 2
  - id: tp4
    text: debounce はボタン起点なら必須ではないと線引きする
    weight: 1
  - id: tp5
    text: title 表示時の XSS innerHTML 直挿しを避ける textContent を使う
    weight: 1
requirements:
  - id: layout
    label: input と button が横並び、その下に結果の div がある
  - id: fetch_and_render
    label: ボタン押下で /search?q= にリクエストし、title を一覧表示する
  - id: no_empty_query
    label: 空クエリではリクエストを送らない
  - id: cache_same_query
    label: 同一クエリの再検索はサーバーに問い合わせない
  - id: abort_stale
    label: 連打・連続検索で古いリクエストの結果が後から表示されない
  - id: cache_bound
    label: キャッシュの鮮度または上限（TTL / LRU）に言及または実装している
rubric_hints:
  correctness: "シナリオ basic-render と same-query-cached の両方が通れば合格ライン。rapid-clicks は加点"
  explanation: "tp2 を『なぜ Map か』『TTL の値の根拠』まで言えれば加点。『サーバーが貧弱』を設計制約として最初に言い換えているか"
  time_management: "10 分経過時点で最低 input/button/fetch の骨格が動いていること"
  red_flags:
    - "innerHTML に title を直接代入している"
    - "キャッシュに上限がなく無限に増えることに触れない"
    - "宣言した中断処理を最後まで実装せず、撤回も言語化しない"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "Pixiv ライブコーディング試験 2026-06-26（Nico の受験記録）"
  license: internal
review:
  reviewed_by: human
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

`input` に検索ワードを入力して `button` を押すと API にリクエストを送る検索フォームを作ってください。

- 送信形式: `https://api.example.com/search?q=〇〇`
- サーバーからは `Array<{ id: number, title: string }>` の JSON が返ります。その内容を `div` に展開し、各要素には `title` を表示してください。
- クエリが空のときは `[]` が返ります。
- **サーバーがとても貧弱なので、極力サーバーに優しくなるよう処理を書いてください。**
- **簡易的なキャッシュ戦略を説明しながら**コーディングしてください。

レスポンス例:

```json
[
  { "id": 1, "title": "Lorem ipsum" },
  { "id": 2, "title": "Dolor" },
  { "id": 3, "title": "Sit amet" },
  { "id": 4, "title": "Consectetur adipiscing elit" }
]
```

## 制約

- レイアウト: input + button が横並び、その下に結果の div。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。`class` / `id` は適当に補ってよい。
- 表示ライブラリ（React/Vue/生 JS）・通信手段（fetch/XHR）は自由。この環境では生 JS + fetch を推奨。
- import は省略可。メソッド名は多少違っても可。
- 設問者への質問は OK。Web 検索は不可。
- 制限時間 20 分。相手からの返答はなく、こちらから一方的に話し続ける形式。

## 面接官メモ（非公開）

- 「貧弱なサーバー」を「リクエスト数を減らす」という設計制約に言い換えられるかを最初の 1 分で見る。
- キャッシュの説明で聞きたいこと: キーは何か（クエリ文字列）、値は何か（結果と取得時刻）、いつ捨てるか（TTL / 件数上限）。
- 連打・連続入力に対する対処（AbortController で古いものを捨てる、または in-flight の Promise を共有する）。
- debounce を持ち出した場合、「ボタン起点なので必須ではない」と線引きできるか。
- XSS: title を innerHTML に直挿ししていないか。
- 時間が足りないときに「ここは省略します」と明言できるか。

## 振り返り用解説（終了後のみ表示）

想定解答の方針（Nico の受験記録より）:

1. サーバーへの不要リクエストを減らす設計を軸に宣言する: ①空クエリは送らない ②同一クエリはキャッシュから返す ③古いリクエストは `AbortController` で中断。
2. キャッシュは `Map<query, { data, ts }>` でクエリをキーに結果を保持。`ts` + TTL で鮮度を担保。発展で LRU（最大件数で古いものから破棄）に言及。
3. 入力中随時検索なら debounce が追加の有力策。今回はボタン起点なので必須ではない、と線引きできると要件理解が伝わる。
4. 描画は `textContent` を使い、title をそのまま HTML として解釈させない。
