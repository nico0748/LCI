---
id: be-0003
slug: cursor-pagination
title: カーソル方式のページネーション
category: BE
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [pixiv]
  nfr: [pagination]
  security: []
  talk_focus: [requirements_clarify, tradeoff, failure_mode]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: pagination.py
    language: python
    content_ref: starter/python/pagination.py
  - path: pagination.ts
    language: typescript
    content_ref: starter/typescript/pagination.ts
talking_points:
  - id: tp1
    text: OFFSET 方式は先頭に新着が挿入されると次ページで重複や欠落が起きるので、最後に返した要素の値をカーソルにする
    weight: 3
  - id: tp2
    text: created_at だけでは同時刻の投稿で境界が曖昧になるので (created_at, id) の組で並べて比較する
    weight: 3
  - id: tp3
    text: limit + 1 件取って次があるかを判定し、ちょうど最後のページで空ページ用の next_cursor を返さない
    weight: 2
  - id: tp4
    text: カーソルは base64 などの不透明な文字列にし、壊れたカーソルは invalid_cursor として拒否する
    weight: 1
  - id: tp5
    text: DB では (created_at DESC, id DESC) の複合インデックスと行値比較で WHERE を書けば深いページでも速い
    weight: 2
requirements:
  - id: order
    label: 新しい順（同時刻は id の大きい順）で limit 件ずつ返す
  - id: no_dup_on_insert
    label: 1 ページ目を取った後に新着が増えても、2 ページ目に重複や欠落が出ない
  - id: ties
    label: 同じ作成時刻の投稿がページの境界をまたいでも欠落・重複しない
  - id: end
    label: 最後のページでは「次のページ」が無いことを返す
  - id: invalid_input
    label: 壊れたカーソルや範囲外の limit を拒否、または安全な値に丸める
rubric_hints:
  correctness: "ties と no_dup_on_insert のテストが通れば合格ライン"
  explanation: "OFFSET との比較を最初に言語化しているか。tp2 の同時刻問題に自分で気づけたら大きく加点"
  time_management: "10 分時点で 1 ページ目と 2 ページ目が取れていること。カーソルの符号化は最後でよい"
  red_flags:
    - "カーソルに配列の添字（オフセット）を入れている"
    - "created_at だけで比較し、同時刻の投稿を落とす／重複させる"
    - "入力の並びがソート済みだと仮定している"
  checklist: []
reference_solutions:
  python: solutions/python/pagination.py
  typescript: solutions/typescript/pagination.ts
source:
  origin: "04 §2.2 BE 代表例（ページネーション）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

投稿一覧 API のページネーションを作ってください。今はページ番号（OFFSET）方式ですが、「次のページを開いたら同じ投稿がまた出てきた」という問い合わせが来ています。人気のサービスなので、一覧を見ている間にも新しい投稿はどんどん増えます。

`paginate(posts, limit, cursor)` は、新しい順に `limit` 件と、次のページを取るための `next_cursor` を返します。1 ページ目は `cursor` を省略します。次のページが無ければ `next_cursor` は空（None / null）です。

`posts` は DB の代わりの配列で、並び順は保証されません。どういう値をカーソルにするか、説明しながら書いてください。

## 制約

- 投稿は `{ id: int, created_at: int（UNIX 秒）, title: str }`。`id` は一意だが、`created_at` は重複しうる。
- 並び順は `created_at` の降順、同じなら `id` の降順。
- Python: `paginate(posts, limit, cursor=None) -> {"items": [...], "next_cursor": str | None}`（`pagination.py`）。
- TypeScript: `paginate(posts, limit, cursor?) -> { items, nextCursor }`（`pagination.ts`）。
- `limit` は 1〜100。100 を超えたら 100 に丸め、1 未満はエラー。壊れたカーソルもエラー（Python は `ValueError`、TypeScript は `Error`）。
- カーソルの中身の形式は自由（クライアントは中身を解釈しない前提）。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に OFFSET の問題（先頭挿入でずれる）を自分の言葉で説明できるかを見る。
- 想定質問と答え:
  - 「カーソルに何を入れる？」→ 最後に返した投稿の (created_at, id)。添字は駄目。
  - 「created_at だけでは？」→ 同時刻が複数あると境界で落ちる／重複する。一意な id で順序を全順序にする。
  - 「次があるかどうかは？」→ limit + 1 件取って判定。件数を数える COUNT は大きな表では重い。
  - 「カーソルが指す投稿が削除されたら？」→ 値で比較しているので問題なく続きが取れる。
  - 「DB では？」→ `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT ?` と複合インデックス。
- ヒントの出し順: (1) 「2 ページ目を取る直前に 1 件増えたら、OFFSET 20 の先頭は何になりますか」 (2) 「同じ秒に 3 件投稿されていて、境界が真ん中だったら？」 (3) 「最後のページで next_cursor を返すと、クライアントは何をしますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: 全件を `(created_at, id)` の降順に並べる（本番は DB の ORDER BY）。カーソルがあれば base64url(JSON) を復号して `(c, i)` を取り出し、`(created_at, id) < (c, i)`（辞書式）の要素だけに絞る。そこから `limit + 1` 件取り、`limit` 件を超えたら最後に返した要素の `(created_at, id)` を符号化して `next_cursor` に、超えなければ None。復号に失敗した、または必要なキーが無いカーソルは `ValueError`。

**別解 A: id だけをカーソルにする**。id が作成順に単調増加するなら（自動採番や Snowflake 型 ID）、`id < cursor` だけで同時刻問題も起きず最も単純。ただし「人気順」「更新順」など id と一致しない並び順に拡張できない。並び順のキーが変わる API ではカーソルに並び順の値も入れる必要がある。

**別解 B: スナップショット方式**。1 ページ目を取った時点の最大 `created_at`（または読み取り時刻）をカーソルに含め、以降のページはその時点以前の投稿だけを返す。新着は「新着 N 件」として別に取りに行かせる UI と相性がよい。ページ間で一覧が完全に固定される一方、削除・非公開化された投稿の扱いを別途決める必要がある。
