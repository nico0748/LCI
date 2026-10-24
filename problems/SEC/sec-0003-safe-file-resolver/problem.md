---
id: sec-0003
slug: safe-file-resolver
title: パストラバーサルを防ぐファイル解決
category: SEC
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: [validation]
  security: [path_traversal]
  talk_focus: [requirements_clarify, failure_mode, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: resolver.py
    language: python
    content_ref: starter/python/resolver.py
  - path: resolver.ts
    language: typescript
    content_ref: starter/typescript/resolver.ts
talking_points:
  - id: tp1
    text: 文字列の .. を消すのではなく、結合して正規化した結果が基準ディレクトリの内側かで判定する
    weight: 3
  - id: tp2
    text: startswith による接頭辞比較は /srv/files と /srv/files-secret を区別できないので commonpath や path.relative で比べる
    weight: 2
  - id: tp3
    text: シンボリックリンクで外へ出られるので realpath で実体を解決してからもう一度内側か確認する（基準ディレクトリ側も realpath）
    weight: 3
  - id: tp4
    text: 存在確認より先に内側判定をして、基準の外にあるファイルの有無を応答の違いで漏らさない
    weight: 1
  - id: tp5
    text: URL デコードはルーティング層で 1 回だけ行い、この関数で %2e%2e を再デコードしない（二重デコードの脆弱性）
    weight: 1
requirements:
  - id: inside_ok
    label: 基準ディレクトリ内のファイルは、途中に .. を含む指定でも内側に留まるなら取得できる
  - id: outside_rejected
    label: 基準ディレクトリの外を指す指定は、存在するかどうかに関係なく拒否される
  - id: symlink
    label: 内側に置かれたシンボリックリンク経由で外のファイルに到達できない
  - id: invalid_rejected
    label: 絶対パス・空文字・NUL 文字・バックスラッシュを含む指定は拒否される
  - id: reason
    label: 見つからない・ディレクトリだった・外を指した、を区別して返す
rubric_hints:
  correctness: "outside_rejected と symlink のテストが通ることが最低ライン"
  explanation: "tp1 の『消すのではなく正規化後に判定』を最初に宣言できたか。tp3 のシンボリックリンクに自分で気づけたら大きく加点"
  time_management: "10 分時点で ../ を含む外向きの指定が拒否されていること"
  red_flags:
    - "user_path.replace('../', '') で対策したつもりになる（....// で回避される）"
    - "startswith(base) だけで内側判定している"
    - "realpath を使わずシンボリックリンクに触れない"
  checklist: []
reference_solutions:
  python: solutions/python/resolver.py
  typescript: solutions/typescript/resolver.ts
source:
  origin: "04 §2.2 SEC 代表例（パストラバーサル）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "realpath で確認してから open するまでの間にリンクを差し替えられる TOCTOU は対象外（O_NOFOLLOW / openat の話として面接官メモにのみ記載）"
    - "テストは POSIX のシンボリックリンクを使う。Windows での実行は想定しない"
---

## 問題文

ユーザーがアップロードした画像を配信する API で、URL のパス部分からファイルを探す関数を作ってください。

`GET /files/<path>` の `<path>` が `resolve_user_file(base_dir, user_path)` に渡ってきます（URL デコード済み）。`base_dir` の中にあるファイルなら、その実際の絶対パスを返してください。それ以外は理由付きで拒否します。

過去に `../../etc/passwd` のような指定でサーバーの設定ファイルが読まれた事故があったそうです。配信用ディレクトリには運用の都合でシンボリックリンクも置かれています。

どんな指定が来うるかを挙げながら書いてください。

## 制約

- Python: `resolve_user_file(base_dir: str, user_path: str) -> str`。拒否は `PathError`（`code` 属性）を送出（`resolver.py`）。
- TypeScript: `resolveUserFile(baseDir: string, userPath: string): string`。拒否は `PathError`（`code` プロパティ）を throw（`resolver.ts`）。
- 理由コード: `invalid_path`（空・NUL を含む・`\` を含む・`/` で始まる）、`outside_base`（基準の外を指す。シンボリックリンク経由も含む）、`not_found`、`not_a_file`（ディレクトリなど）。
- 戻り値はシンボリックリンクを解決した実際の絶対パス。`base_dir` 自体がシンボリックリンクの場合もある。
- `user_path` の追加の URL デコードはしない。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に「文字列を掃除する」のか「正規化してから判定する」のかを見る。前者に進んだら 1 回だけ「`....//` はどうなりますか」と聞く。
- 想定質問と答え:
  - 「`..` を消せばいい？」→ 消した結果がまた `..` になる。正規化後の位置で判定する。
  - 「`startswith` で比べる？」→ `/srv/files-secret` が通る。`commonpath` / `path.relative`。
  - 「シンボリックリンクは？」→ realpath で実体にしてから再判定。基準ディレクトリも realpath（macOS の `/tmp` は `/private/tmp` へのリンク）。
  - 「存在しない外側のファイルは？」→ not_found ではなく outside_base。外側の有無を漏らさない。
  - 「確認から open までの間にリンクを差し替えられたら？」→ TOCTOU。openat + O_NOFOLLOW や、配信をアプリでなく Web サーバー（alias / X-Accel-Redirect）に任せる。
- ヒントの出し順: (1) 「`img/../../secret.txt` は最終的にどこを指しますか」 (2) 「基準が `/srv/files` のとき `/srv/files-secret/x` は内側ですか」 (3) 「`ln -s /etc/passwd public/p.txt` があったら？」

## 振り返り用解説（終了後のみ表示）

**想定解答**: (1) 入力の形を検査（空・NUL・`\`・先頭 `/` は `invalid_path`）。(2) `base = realpath(base_dir)`、`candidate = normpath(join(base, user_path))` を作り、`commonpath([base, candidate]) != base` なら `outside_base`（存在確認より先）。(3) 存在しなければ `not_found`。(4) `real = realpath(candidate)` を取り、もう一度内側判定（シンボリックリンク対策）。(5) 通常ファイルでなければ `not_a_file`。`real` を返す。

**別解 A: 許可リスト方式（ID で引く）**。そもそもパスを受け取らず、`GET /files/<file_id>` で DB に保存した ID から保存先を引く。保存時のファイル名は UUID などサーバーが決める。パストラバーサルという問題自体が消えるので、新規設計ならこちらが第一候補。既存の URL 体系を変えられないときに本問の関数が必要になる。

**別解 B: OS に閉じ込めてもらう**。`openat2(RESOLVE_BENEATH)`（Linux 5.6+）や chroot / コンテナのマウントで、基準ディレクトリの外をそもそも開けないようにする。アプリの判定ロジックに依存しないので TOCTOU も防げるが、移植性が低く、面接では「知っている」と言えれば十分。
