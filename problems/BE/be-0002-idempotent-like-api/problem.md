---
id: be-0002
slug: idempotent-like-api
title: 冪等ないいね API（Idempotency-Key）
category: BE
tier: core
difficulty: L3
time_limit: 30
languages: [python, typescript]
tags:
  company_style: [pixiv]
  nfr: [idempotency]
  security: []
  talk_focus: [requirements_clarify, tradeoff, failure_mode]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: like_api.py
    language: python
    content_ref: starter/python/like_api.py
  - path: like_api.ts
    language: typescript
    content_ref: starter/typescript/like_api.ts
talking_points:
  - id: tp1
    text: いいね状態を (user_id, post_id) の集合で持てば、キーが無くても二重いいねで like_count が増えない自然な冪等性になる
    weight: 3
  - id: tp2
    text: Idempotency-Key ごとに最初の応答（ステータスと body）を保存し、再送には件数が変わっていても同じ応答を返す
    weight: 3
  - id: tp3
    text: 同じキーが別の操作や別の post_id に使われたら 422 で拒否し、リクエスト内容の指紋をキーと一緒に保存する
    weight: 2
  - id: tp4
    text: キーはユーザーごとの名前空間にし、24 時間の TTL で保存領域を解放する
    weight: 2
  - id: tp5
    text: 入力検証の 400 は保存しない（直して同じキーで再送できるようにする）と線引きする
    weight: 1
  - id: tp6
    text: 本番では処理中の同一キーを 409 で弾く、または DB の一意制約とトランザクションで保存と反映を原子的にする
    weight: 1
requirements:
  - id: no_double_count
    label: 同じユーザーが同じ投稿を何回いいねしても件数は 1 しか増えない
  - id: replay_same_response
    label: 同じ Idempotency-Key での再送には、最初と同じステータスと内容を返す
  - id: key_mismatch
    label: 同じキーを別の内容のリクエストに使い回すと拒否される
  - id: key_scope_ttl
    label: キーはユーザーごとに独立し、24 時間経つと忘れられる
  - id: unlike
    label: いいね解除ができ、件数が 0 未満にならない
  - id: invalid_not_stored
    label: 不正なリクエストはエラーになるが、そのキーで正しいリクエストを送り直せる
rubric_hints:
  correctness: "replay_same_response と no_double_count のテストが通れば合格ライン"
  explanation: "『自然な冪等性（集合）』と『キーによる応答の再現』が別物だと切り分けて説明できるか。tp2 で『なぜ保存した応答を返すのか（クライアントは最初の応答を受け取れていない可能性がある）』まで言えれば加点"
  time_management: "15 分時点で like の二重カウント防止が動いていること。TTL は最後でよい"
  red_flags:
    - "like_count を単純なカウンタで +1 しており、二重いいねで増える"
    - "再送時に保存した応答ではなく現在の件数で応答を作り直している"
    - "キーをユーザーで区切らず、他人のキーと衝突する"
  checklist: []
reference_solutions:
  python: solutions/python/like_api.py
  typescript: solutions/typescript/like_api.ts
source:
  origin: "04 §2.2 BE 代表例（いいね API の冪等性）を元に手書き。Stripe の Idempotency-Key の挙動を参考"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "インメモリ・単一スレッド前提なので、処理中キーの 409（同時実行）はテストしていない。talking point としてのみ扱う"
---

## 問題文

イラスト投稿サービスの「いいね」API をインメモリで作ってください。モバイルアプリは通信が切れると同じリクエストを再送するので、二重に数えられたり、再送で違う結果が返ったりしないようにしたいです。

- `like(user_id, post_id, idempotency_key)` と `unlike(...)` を作り、`(ステータス, body)` を返してください。body は `{"post_id", "liked", "like_count"}` です。
- 初めてのいいねは 201、既にいいね済みなら 200、解除は常に 200 です。
- 同じキーでの再送には最初と同じ応答を返してください。
- キーは省略されることもあります。

どこまでを冪等と呼ぶか、説明しながら進めてください。

## 制約

- Python は `like_api.py` の `class LikeApi`、TypeScript は `like_api.ts` の `export class LikeApi` を編集する。
- コンストラクタは時計関数（秒を返す）を受け取る: Python `LikeApi(clock)`、TypeScript `new LikeApi(clock)`。テストは偽の時計を渡す。
- 戻り値: Python は `(status: int, body: dict)`、TypeScript は `{ status: number, body: object }`。`count(post_id)` で現在の件数を返す。
- 同じキーを別の操作・別の post_id に使ったら `(422, {"error": "idempotency_key_reused"})`。
- `user_id` か `post_id` が空文字なら `(400, {"error": "invalid_request"})`。
- キーはユーザーごとに独立し、最初の使用から 24 時間（86400 秒）で失効する。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に「冪等」を 2 段階に分けられるかを見る: (a) 操作自体が冪等（集合への追加）、(b) キーによる応答の再現（クライアントが最初の応答を受け取れなかった場合の救済）。
- 想定質問と答え:
  - 「キーが無いときは？」→ (a) だけで二重カウントは防げる。ただし 201/200 の違いは再送で変わる。
  - 「再送時に今の件数を返しては駄目？」→ クライアントにとって最初の応答と矛盾する。保存した応答をそのまま返す。
  - 「同じキーで別の投稿？」→ クライアントのバグ。黙って処理せず 422。
  - 「キーの保存期間は？」→ 24 時間。再送が起こりうる時間より十分長く、保存領域が増え続けない長さ。
  - 「複数台・同時に同じキーが来たら？」→ 処理中フラグを先に原子的に立て、後続は 409。DB なら一意制約。
- ヒントの出し順: (1) 「いいねの状態は数ですか、集合ですか」 (2) 「再送してくるクライアントは、最初の応答を受け取れていますか」 (3) 「同じキーで違う内容が来たら？」
- 30 分で全部は難しい。TTL と 400 非保存は後回しでも、優先順位を宣言していれば可。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 状態は `likes: Set<(user, post)>` と `counts: Map<post, int>`（件数は集合から数えてもよい）。キーは `Map<(user, key), {fingerprint, status, body, expires_at}>`。処理順は (1) 入力検証（失敗は保存せず 400）→ (2) キーがあれば保存済みを探し、期限内なら fingerprint（操作名＋post_id）を比べて一致なら保存した応答のコピーを返し、不一致なら 422 → (3) 集合を更新して応答を作る → (4) キーがあれば応答を保存。応答のコピーを返すのは、呼び出し側が辞書を書き換えても保存内容が壊れないようにするため。

**別解 A: キーを使わず PUT /posts/:id/like で状態指定にする**。「いいね状態を true にする」という PUT は本来冪等で、キー管理が要らない。トグル型（押すたびに反転）の API を避けるだけで問題の大半が消える。ただし 201/200 の区別や「最初の応答」の再現はできない。

**別解 B: DB の一意制約に寄せる**。`likes(user_id, post_id)` に一意制約を張り、`INSERT ... ON CONFLICT DO NOTHING` の影響行数で 201/200 を決める。件数はトリガーか集計で持つ。キー保存テーブルも `(user_id, key)` を主キーにして同じトランザクションで書けば、複数台・同時実行でも整合する。インメモリ実装より本番に近いが、30 分の面接ではスキーマの説明にとどめるのが現実的。
