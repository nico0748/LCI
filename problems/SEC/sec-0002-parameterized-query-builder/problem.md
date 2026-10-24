---
id: sec-0002
slug: parameterized-query-builder
title: 検索条件からのパラメータ化クエリ生成
category: SEC
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: [validation]
  security: [sqli]
  talk_focus: [requirements_clarify, failure_mode]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: query.py
    language: python
    content_ref: starter/python/query.py
  - path: query.ts
    language: typescript
    content_ref: starter/typescript/query.ts
talking_points:
  - id: tp1
    text: 値はすべてプレースホルダ ? と params に分け、SQL 文字列に利用者の入力を連結しない
    weight: 3
  - id: tp2
    text: 列名や ORDER BY の向きはプレースホルダにできないので、sort は許可リストの対応表から SQL 断片を選ぶ
    weight: 3
  - id: tp3
    text: LIKE の % と _ と \ を値の側でエスケープし ESCAPE 句を付けないと、ワイルドカードとして解釈される
    weight: 2
  - id: tp4
    text: 未知の filters キーや型の違う値は黙って無視せず ValueError で拒否する（キー名を SQL に入れない）
    weight: 2
  - id: tp5
    text: ids の IN 句は要素数ぶん ? を並べ、空配列は 1 = 0 にし、件数上限で巨大なクエリを防ぐ
    weight: 1
requirements:
  - id: filters
    label: 指定された条件だけで絞り込み、条件を組み合わせられる
  - id: no_injection
    label: 検索語や並び順に SQL の断片を入れても、意図しない行が返ったり表が壊れたりしない
  - id: like_literal
    label: 部分一致検索で % や _ を含む語は文字どおりに検索される
  - id: sort_allowlist
    label: 決められた並び順以外は拒否される
  - id: reject_unknown
    label: 知らない条件名や型の違う値は拒否される
  - id: ids
    label: id の一覧で絞り込め、空の一覧なら結果が空になる
rubric_hints:
  correctness: "no_injection と sort_allowlist のテストが全部通ることが最低ライン"
  explanation: "tp2（識別子はプレースホルダにできない）を自分から言えるか。tp3 の LIKE のワイルドカードは気づけば加点"
  time_management: "10 分時点で author_id と title_contains の 2 条件が動いていること"
  red_flags:
    - "f-string / テンプレート文字列で値を SQL に埋め込んでいる"
    - "sort をそのまま ORDER BY に連結し、文字種チェックだけで防いだつもりになる"
    - "未知のキーを列名として SQL に入れている"
  checklist: []
reference_solutions:
  python: solutions/python/query.py
  typescript: solutions/typescript/query.ts
source:
  origin: "04 §2.2 SEC 代表例（SQLi 安全なクエリ）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "TypeScript のテストは node:sqlite を使う。Node 22.12 では --experimental-sqlite が必要なのでコマンドに付けている"
---

## 問題文

投稿の管理画面に検索機能を付けます。画面から来た検索条件を受け取って、SQL とパラメータを組み立てる関数を作ってください。実行はこの関数の外で行います。

`build_post_search(filters, sort, limit)` は `(sql, params)` を返します。

- 条件は「投稿者 ID」「状態」「タイトルの部分一致」「作成日時の範囲」「id の一覧」で、どれも省略できます。
- 並び順は「新しい順」「古い順」「いいねが多い順」などを画面のプルダウンから選びます。
- 管理画面とはいえ、値は利用者が自由に送れます。

どこが危ないのかを説明しながら書いてください。

## 制約

- 表 `posts(id INTEGER, author_id INTEGER, title TEXT, status TEXT, created_at INTEGER, like_count INTEGER)`。SQLite。プレースホルダは `?`。SQL の 1 列目は `id`。
- `filters` のキー: `author_id`（整数）、`status`（`draft` / `published` / `archived`）、`title_contains`（文字列）、`created_from` / `created_to`（整数、両端を含む）、`ids`（整数の配列、100 件まで）。
- `sort`: `created_at` / `-created_at`（既定）/ `like_count` / `-like_count` / `id` / `-id`（`-` は降順）。同値は `id` の降順。
- `limit`: 1〜100（既定 20）。
- 上記以外のキー・値・型は Python は `ValueError`、TypeScript は `Error`。
- Python: `build_post_search(filters, sort="-created_at", limit=20) -> tuple[str, list]`（`query.py`）。TypeScript: `buildPostSearch(filters, sort?, limit?) -> { sql, params }`（`query.ts`）。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初の 1 分で「値」と「識別子（列名・並び順）」で対策が違うことに気づけるかを見る。
- 想定質問と答え:
  - 「値の対策は？」→ プレースホルダ。エスケープ関数を自作しない。
  - 「ORDER BY はプレースホルダにできる？」→ できない（値として扱われ、並び替えにならない）。許可リストの対応表から SQL 断片を選ぶ。
  - 「`title_contains` に `%` が入ったら？」→ 全件一致になる。値側で `\` `%` `_` をエスケープし `ESCAPE '\'`。
  - 「知らないキーは無視でいい？」→ 画面のバグや攻撃の兆候を隠すので拒否。キー名を SQL に入れないのが大前提。
  - 「ids が 1 万件だったら？」→ プレースホルダ数の上限や性能。件数上限か一時テーブル。
- ヒントの出し順: (1) 「sort に `created_at; DROP TABLE posts` が来たら？」 (2) 「`100%` で検索したら何件出ますか」 (3) 「`author_id` に文字列 `1 OR 1=1` が来たら？」

## 振り返り用解説（終了後のみ表示）

**想定解答**: `where: list[str]` と `params: list` を用意し、許可したキーごとに対応する条件断片（`author_id = ?` など）と値を追加する。型は整数なら `isinstance(v, int) and not isinstance(v, bool)` で確認。`title_contains` は `v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")` を `%…%` で挟んで `title LIKE ? ESCAPE '\'`。`ids` は空なら `1 = 0`、そうでなければ `id IN (?, ?, …)`。並び順は `{"-created_at": "created_at DESC, id DESC", …}` の辞書から引き、無ければ拒否。最後に `SELECT … FROM posts [WHERE …] ORDER BY … LIMIT ?`。

**別解 A: クエリビルダ / ORM を使う**。SQLAlchemy Core や Knex のような層は値を必ずバインドし、列はオブジェクトとして参照するため、文字列連結の余地がほとんど無い。面接では「本番ならこれを使う、今回は仕組みを見せるために手で組む」と言えれば十分。ただし `order_by(text(sort))` のように生 SQL を渡す API は同じ危険がある。

**別解 B: 条件ごとに固定 SQL を用意する**。条件の組合せが少ないなら、組合せごとのクエリを静的に書いておく（または `(? IS NULL OR author_id = ?)` のように常に全条件を書き NULL で無効化する）。SQL が静的になりレビューしやすい一方、条件が増えると組合せ爆発するか、インデックスが効かない書き方になりがち。
