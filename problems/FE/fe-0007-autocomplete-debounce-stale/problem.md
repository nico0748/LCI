---
id: fe-0007
slug: autocomplete-debounce-stale
title: オートコンプリート（debounce と古い応答の破棄）
category: FE
tier: core
difficulty: L3
time_limit: 30
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [debounce, abort, cache]
  security: [xss]
  talk_focus: [tradeoff, edge_cases, requirements_clarify]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: 入力のたびに問い合わせず、debounce で入力が止まってから 1 回だけ問い合わせる（待ち時間と体感速度のトレードオフ）
    weight: 3
  - id: tp2
    text: 応答は送った順に届くとは限らないので、前の要求を中断するか、応答がどの入力に対するものかを確かめて、古い候補で上書きしない
    weight: 3
  - id: tp3
    text: 2 文字未満では問い合わせず候補を消す。このとき進行中の要求の応答で候補が復活しないようにする
    weight: 2
  - id: tp4
    text: 一度取った語の候補は Map にキャッシュし、同じ語に戻ったときは問い合わせない（上限や有効期限も検討する）
    weight: 2
  - id: tp5
    text: 候補は textContent で表示する。一致部分を強調したいときも innerHTML ではなく要素を組み立てる
    weight: 1
  - id: tp6
    text: 上下キーでの選択や aria-activedescendant などのアクセシビリティは、時間があれば対応すると線引きする
    weight: 1
requirements:
  - id: suggest
    label: 2 文字以上の入力で候補を取得して一覧表示する
  - id: min_length
    label: 2 文字未満では問い合わせず、候補を消す
  - id: debounce
    label: 入力が止まってから問い合わせる
  - id: stale
    label: 遅れて届いた古い応答で候補を上書きしない
  - id: cache
    label: 同じ語の候補は再取得しない
  - id: safe_render
    label: 候補を HTML として解釈させずに表示する
rubric_hints:
  correctness: "min-length と debounce-typing が通れば合格ライン。stale-response・clear-on-short・suggest-cache は加点"
  explanation: "debounce・中断（または照合）・キャッシュがそれぞれ何を防ぐかを分けて説明できるか。debounce の時間をどう決めるかに触れれば加点"
  time_management: "10 分で候補の取得と表示、20 分で debounce・古い応答の破棄・キャッシュ、残りで説明"
  red_flags:
    - "input イベントごとに問い合わせる"
    - "遅れて届いた古い候補で一覧を上書きする"
    - "入力を消した後に、進行中の応答で候補が復活する"
    - "候補を innerHTML で描画している"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（技術記事サイトのタグ検索を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

検索欄に入力すると候補を表示するオートコンプリートを作ってください。

- 入力が 2 文字以上になったら `GET https://api.example.com/suggest?q=<入力>` で候補を取得し、入力欄の下に一覧表示します。レスポンスは `string[]` です。
- 2 文字未満になったら問い合わせず、候補を消します。
- **サーバーがとても貧弱です。** 1 文字打つたびに問い合わせないでください（入力が止まってから問い合わせる）。一度取得した語の候補は取り直さないでください。
- 応答は送った順に届くとは限りません。**遅れて届いた古い応答で候補を上書きしないでください。**

## 制約

テストで使うので、次の id を付けてください。

| 要素 | 指定 |
| --- | --- |
| 入力欄 | `<input id="q">` |
| 候補一覧 | `<ul id="suggestions">`。候補 1 件ごとに直下の `<li>` を 1 つ。候補が無いときは `<li>` を置かない |

- 候補を選んだときの動作（入力欄に入れる、キー操作で選ぶ）は任意です。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- fe-0001 の発展。debounce・中断・キャッシュの 3 つを、それぞれ何のためかを分けて話せるかを見る。
- 想定質問と答え:
  - 「debounce の時間は？」→ 任せる（200〜400ms が目安）。短すぎると要求が減らず、長すぎると反応が遅く感じる。
  - 「キャッシュの期限は？」→ 候補は数分で変わらない想定。上限（件数）だけでもよい。
  - 「大文字小文字は区別する？」→ 今回は入力どおりに送ってよい。正規化（小文字化・NFKC）してからキーにする案は加点。
  - 「IME の変換中は？」→ 変換中（compositionstart〜end）は問い合わせない、という配慮に触れれば加点。テストはしない。
- 入力を 1 文字に戻したときに、進行中の応答で候補が復活しないか（clear-on-short）を必ず確認する。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. `input` イベントで `current = input.value.trim()` を更新し、既存のタイマーを消す。2 文字未満なら進行中の要求を中断して候補を消し、終わる。
2. キャッシュ（`Map<語, 候補>`）にあれば即表示して終わる。無ければ debounce（例: 250ms）の後に問い合わせる。
3. 問い合わせの前に、前の要求を `AbortController` で中断する。応答が来たらキャッシュに保存し、その語が今の `current` と同じときだけ表示する（中断し損ねた場合の保険）。
4. 候補は `<li>` を作って `textContent` で入れる。

**3 つの役割**: debounce は「送る数」を減らす。キャッシュは「同じものを二度取らない」。中断（または照合）は「古い結果を表示しない」。debounce だけでは、遅い応答が後から届いたときの上書きは防げない。

**発展**: 進行中の要求も `Map<語, Promise>` で共有すると、同じ語を素早く打ち直したときの重複も防げる。キー操作（上下・Enter・Esc）と `role="listbox"` / `aria-activedescendant` に対応すると、スクリーンリーダーでも使える。
