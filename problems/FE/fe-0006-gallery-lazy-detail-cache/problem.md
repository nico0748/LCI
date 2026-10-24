---
id: fe-0006
slug: gallery-lazy-detail-cache
title: 画像ギャラリーの遅延読込と詳細キャッシュ
category: FE
tier: core
difficulty: L2
time_limit: 20
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [cache, abort]
  security: [xss]
  talk_focus: [tradeoff, requirements_clarify]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: サムネイルは img に loading="lazy" を付け、画面外の画像を最初から読み込まない（width / height も指定してレイアウトのずれを防ぐ）
    weight: 2
  - id: tp2
    text: 一度取得した詳細は id をキーに Map へ保存し、同じ作品をもう一度開いたときは問い合わせない
    weight: 3
  - id: tp3
    text: 素早く別の作品に切り替えたとき、前の詳細の要求を中断するか、応答の id が今選んでいる id と一致するか確かめて、古い詳細を表示しない
    weight: 3
  - id: tp4
    text: キャッシュに上限や有効期限を設けるか（閲覧数の多いギャラリーでメモリが増え続けないか）を判断して説明する
    weight: 1
  - id: tp5
    text: 説明文は利用者が書いた文字列なので textContent で表示し、HTML として解釈させない
    weight: 1
requirements:
  - id: grid
    label: 一覧を読み込み、遅延読込のサムネイルを並べる
  - id: detail
    label: サムネイルを押すと詳細（タイトル・作者・説明）を表示する
  - id: cache
    label: 一度開いた作品の詳細は再取得しない
  - id: latest_wins
    label: 素早く切り替えても、最後に選んだ作品の詳細だけを表示する
  - id: safe_render
    label: 説明文を HTML として解釈させずに表示する
rubric_hints:
  correctness: "show-detail と detail-cache が通れば合格ライン。rapid-switch は加点"
  explanation: "キャッシュのキーと上限の考え方、中断と応答の照合の違いを説明できるか。loading=\"lazy\" と IntersectionObserver の使い分けに触れれば加点"
  time_management: "7 分で一覧と詳細、14 分でキャッシュと切り替え対策、残りで説明"
  red_flags:
    - "サムネイルを押すたびに詳細を取り直す"
    - "遅れて届いた前の作品の詳細で表示を上書きする"
    - "説明文を innerHTML で描画している"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（イラスト投稿サイトの作品一覧を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

作品のサムネイル一覧と、選んだ作品の詳細を表示するギャラリーを作ってください。

- ページを開いたら `GET https://api.example.com/photos` で一覧を取得します。レスポンスは `Array<{ id: number, title: string, thumb: string }>`（`thumb` は画像の URL）です。
- サムネイルは**遅延読込**にしてください（画面外の画像を最初から読み込まない）。
- サムネイルを押すと `GET https://api.example.com/photos/<id>` で詳細を取得して表示します。レスポンスは `{ id: number, title: string, author: string, description: string }` です。
- **サーバーがとても貧弱です。** 一度開いた作品の詳細は取り直さないでください。
- 素早く別の作品に切り替えたときに、前に選んだ作品の詳細が後から表示されないようにしてください。

## 制約

テストで使うので、次の id / 属性を付けてください。

| 要素 | 指定 |
| --- | --- |
| サムネイル一覧 | `id="grid"` の要素の中に、作品ごとに `<button data-id="<作品 id>">` を置き、その中に `<img>` を入れる |
| 詳細 | `id="detail"` の要素に、タイトル・作者・説明を表示する |

- この環境では外部の画像は読み込めないため、`thumb` には data URL が入っています。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 「遅延読込」を `loading="lazy"` で済ませるか、IntersectionObserver で自前で書くかは自由。前者で十分と判断できれば良い。
- 想定質問と答え:
  - 「キャッシュに期限は要る？」→ 作品の詳細はほとんど変わらないので、今回は無期限でよい。上限（例: 100 件で古いものから捨てる）に触れれば加点。
  - 「詳細の取得中は何を表示する？」→ 「読み込み中…」程度でよい。
  - 「切り替えたら前の要求は中断する？」→ どちらでもよい。中断した場合、その作品はまだキャッシュに入っていないことに注意。
- XSS: 説明文に HTML が入った作品がある（id=5）。innerHTML で描画していないかを見る。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. 一覧は `<button data-id>` の中に `<img loading="lazy" width height alt>` を入れて並べる。`width` / `height` を指定すると、画像が届く前後で配置がずれない。
2. 詳細は `Map<id, detail>` にキャッシュする。押されたらまず `selectedId` を更新し、キャッシュにあれば即表示、なければ「読み込み中…」を出して取得する。
3. 取得前に前の要求を `AbortController` で中断する。応答が来たら `selectedId` と一致するときだけ表示する（中断し損ねた場合の保険）。キャッシュへの保存は一致しなくても行ってよい（次に開いたときに使える）。
4. 描画は `textContent` で行う。

**発展**: 進行中の要求も `Map<id, Promise>` で共有すると、同じ作品を連打したときの重複要求も防げる。キャッシュの上限は `Map` の挿入順を使った LRU で実装できる。
