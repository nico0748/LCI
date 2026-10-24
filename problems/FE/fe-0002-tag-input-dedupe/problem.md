---
id: fe-0002
slug: tag-input-dedupe
title: タグ入力（重複排除と変更時のみ保存）
category: FE
tier: core
difficulty: L1
time_limit: 20
languages: [html]
tags:
  company_style: [pixiv]
  nfr: [validation, idempotency]
  security: [xss]
  talk_focus: [requirements_clarify, edge_cases]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: index.html
    language: html
    content_ref: starter/index.html
talking_points:
  - id: tp1
    text: 前後の空白を除き、NFKC と小文字化で正規化したキーで比べて、全角・半角や大文字・小文字の表記ゆれを同じタグとみなす
    weight: 3
  - id: tp2
    text: 保存前に、最後に保存した（読み込んだ）タグ集合と比べ、変わっていなければリクエストを送らない
    weight: 3
  - id: tp3
    text: 保存中はボタンを無効化するなどして、連打で同じ PUT が何度も飛ばないようにする
    weight: 2
  - id: tp4
    text: タグ名は textContent で表示し、利用者の入力を innerHTML に入れない
    weight: 1
  - id: tp5
    text: 上限 5 個や空文字などの入力エラーを、黙って捨てずに理由を表示する
    weight: 1
requirements:
  - id: add_remove
    label: タグを追加・削除でき、個数を「N/5」で表示する
  - id: dedupe
    label: 表記ゆれ（全角半角・大文字小文字・前後の空白）を同じタグとして重複を防ぐ
  - id: limit
    label: 空のタグと 6 個目以降のタグは追加せず、理由を表示する
  - id: save_if_changed
    label: 保存ボタンは前回保存時から変わったときだけ PUT を送る
  - id: no_double_save
    label: 保存の連打で PUT を重複して送らない
  - id: safe_render
    label: タグ名を HTML として解釈させずに表示する
rubric_hints:
  correctness: "add-and-count と dedupe-normalized が通れば合格ライン。save-only-when-changed と double-save は加点"
  explanation: "正規化キーと表示用の文字列を分けて持つ理由、「変更があったか」の判定を集合の比較で行う理由を説明できるか"
  time_management: "8 分で追加・削除・表示、15 分で重複排除と保存、残りで連打対策と説明"
  red_flags:
    - "入力文字列をそのまま比較して、全角や大文字のタグが重複して入る"
    - "保存ボタンを押すたびに無条件で PUT を送る"
    - "innerHTML でタグ名を描画している"
reference_solutions:
  html: solutions/html/index.html
source:
  origin: "LCI オリジナル（イラスト投稿サイトの作品タグ編集を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

作品に付けるタグを編集する UI を作ってください。

- ページを開いたら `GET https://api.example.com/works/42/tags` で現在のタグを取得して表示します。レスポンスは `string[]` の JSON です（例: `["オリジナル", "風景"]`）。
- 入力欄に文字を入れて追加ボタンを押すとタグが増えます。各タグには削除ボタンを付けます。
- 全角・半角、大文字・小文字、前後の空白だけが違うものは**同じタグ**とみなし、重複して追加しません（例: `ＯＣ` と ` oc ` は同じ）。
- タグは最大 5 個です。空のタグも追加しません。追加できなかったときは理由を表示してください。
- 保存ボタンを押すと `PUT https://api.example.com/works/42/tags` に `string[]` の JSON を送ります。**前回保存した（または読み込んだ）ときから変わっていなければ送りません。** 一度消して同じタグを追加し直した場合も「変わっていない」とみなします。
- サーバーへの負荷を下げるため、保存の連打で同じ PUT を何度も送らないでください。

## 制約

テストで使うので、次の id / 属性を付けてください。

| 要素 | 指定 |
| --- | --- |
| タグ名の入力欄 | `<input id="tag-input">` |
| 追加ボタン | `<button id="add-tag">` |
| タグ一覧 | `id="tags"` の要素の中に、タグごとの要素を並べる |
| 削除ボタン | タグごとに `<button class="remove-tag" data-tag="（表示しているタグ名）">` |
| 個数 | `id="count"` に `3/5` の形式 |
| 入力エラー | `id="error"`（重複は「すでに追加されています」、上限は「5 個まで」を含む文言） |
| 保存ボタン・結果 | `<button id="save">`、結果は `id="status"`（「保存しました」または「変更はありません」） |

- レイアウト: 入力欄と追加ボタンが横並び、その下にタグ一覧。
- CSS を使う場合は Tailwind CSS（埋め込み済み）を使ってよい。
- 表示ライブラリ・通信手段は自由。この環境では生 JS + fetch を推奨。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 「同じタグ」の定義を最初に確認するかを見る（全角半角・大小・空白）。正規化キー（比較用）と表示用の文字列を分けて持てるか。
- 「変更があったか」を、配列の参照や長さでなく、正規化キーの集合で比べられるか。
- 想定質問と答え:
  - 「表示は入力どおり？正規化後？」→ 前後の空白を除き NFKC をかけたものを表示してよい（大文字小文字は入力どおりで可）。
  - 「タグの並び順は保存に影響する？」→ 今回は影響しない（集合として比べる）。
  - 「保存に失敗したら？」→ 失敗を表示し、もう一度押せば再送できればよい。
- 連打対策は「保存中は disabled」「保存中フラグで無視」のどちらでもよい。成功後に基準となる集合を更新することに触れられれば加点。

## 振り返り用解説（終了後のみ表示）

**想定解答の方針**:

1. タグは `{ label, key }` の配列で持つ。`key = label.trim().normalize("NFKC").toLowerCase()`。追加時に `key` が既にあれば「すでに追加されています」。
2. 読み込み直後と保存成功時に、`key` を並べ替えて連結した文字列（または `Set`）を「最後に保存した状態」として覚えておく。保存ボタンでは現在の状態と比べ、同じなら「変更はありません」と表示して終わる。
3. 保存中は `#save` を `disabled` にして、二重送信を防ぐ。成功したら基準の状態を更新し、失敗したら基準を変えずにエラー表示（再送できる）。
4. 描画は `textContent` で行い、タグ名を HTML として解釈させない。`data-tag` 属性は `dataset` に入れれば安全。

**よくある落とし穴**: `normalize("NFKC")` を忘れて全角英数字が別タグになる／`toLowerCase` だけで全角を見落とす／保存ボタンの直後に基準を更新してしまい、失敗したときに「変更なし」と誤判定する。
