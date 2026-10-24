---
id: be-0004
slug: webhook-hmac-verify
title: Webhook の HMAC 署名検証
category: BE
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: [validation]
  security: [secrets]
  talk_focus: [requirements_clarify, failure_mode, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: webhook.py
    language: python
    content_ref: starter/python/webhook.py
  - path: webhook.ts
    language: typescript
    content_ref: starter/typescript/webhook.ts
talking_points:
  - id: tp1
    text: JSON をパースして再シリアライズした文字列ではなく、受け取った生のボディのバイト列で HMAC を計算する
    weight: 3
  - id: tp2
    text: 署名の比較は hmac.compare_digest / timingSafeEqual の定数時間比較にしてタイミング攻撃を防ぐ
    weight: 2
  - id: tp3
    text: タイムスタンプを署名対象に含め、許容幅 300 秒を超えた古い要求を拒否してリプレイ攻撃の窓を狭める
    weight: 3
  - id: tp4
    text: 鍵のローテーション中は v1 が複数付くので、どれか 1 つが有効な secret と一致すれば受理する
    weight: 1
  - id: tp5
    text: 許容幅内の再送は event id を記録して二重処理を防ぐ必要があり、署名検証だけでは足りない
    weight: 1
requirements:
  - id: accept_valid
    label: 正しい署名と許容時間内のタイムスタンプを持つ要求を受理し、イベント内容を返す
  - id: reject_tampered
    label: ボディが 1 バイトでも変わった要求、別の鍵で署名された要求を拒否する
  - id: reject_stale
    label: タイムスタンプが現在時刻から 300 秒より離れている要求を拒否する（過去・未来とも）
  - id: reject_malformed
    label: 署名ヘッダの形式が不正な要求を拒否する
  - id: rotation
    label: 鍵のローテーション中（新旧の鍵・新旧の署名が混在）でも正しい要求は受理される
  - id: reason
    label: 拒否理由を区別して呼び出し元に返す
rubric_hints:
  correctness: "accept_valid / reject_tampered / reject_stale が通れば合格ライン"
  explanation: "tp1（生のボディ）を自分から言えるか。tp3 で『なぜタイムスタンプも署名対象に入れるのか（入れないと t を書き換えられる）』まで言えれば加点"
  time_management: "10 分時点で 1 つの secret・1 つの v1 で検証が通ること。ローテーションは後回しでよい"
  red_flags:
    - "== や === で署名文字列を比較している"
    - "JSON.parse してから JSON.stringify したものに署名している"
    - "タイムスタンプを見ずに署名だけ検証している"
    - "secret をログやエラーメッセージに出している"
  checklist: []
reference_solutions:
  python: solutions/python/webhook.py
  typescript: solutions/typescript/webhook.ts
source:
  origin: "04 §2.2 BE 代表例（Webhook 受信と署名検証）を元に手書き。Stripe の署名ヘッダ形式を参考にした"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "event id による重複排除（リプレイ）は talking point のみでテストしていない"
---

## 問題文

決済サービスから届く Webhook の受信処理で、署名の検証部分を作ってください。

決済サービスは共有の secret で HMAC-SHA256 署名を作り、`X-Signature: t=1730000000,v1=5f2b…` というヘッダを付けて POST してきます。`t` は送信時刻（UNIX 秒）、`v1` は `"{t}.{生のボディ}"` の署名の 16 進文字列です。鍵の入れ替え中は `v1` が複数付くことがあります。

`verify_webhook(raw_body, header, secrets, now)` は、本物の要求ならボディを JSON として解釈したイベントを返し、そうでなければ理由付きで拒否してください。何から守っているのかを説明しながら書いてください。

## 制約

- Python: `verify_webhook(raw_body: bytes, header: str, secrets: list[str], now: int) -> dict`。拒否は `WebhookError`（`code` 属性に理由）を送出（`webhook.py`）。
- TypeScript: `verifyWebhook(rawBody: Buffer, header: string, secrets: string[], now: number): unknown`。拒否は `WebhookError`（`code` プロパティ）を throw（`webhook.ts`）。
- 理由コード: `malformed_header`（`t` が整数でない・`t` か `v1` が無い）、`timestamp_out_of_range`（|now - t| > 300）、`signature_mismatch`、`invalid_payload`（署名は正しいが JSON でない）。
- `v1` 以外の項目（例 `v0=`）は無視する。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に「何から守るか」を 3 つに分けられるか: なりすまし（鍵を知らない第三者）、改ざん、リプレイ（盗聴した本物の再送）。
- 想定質問と答え:
  - 「ボディはパース後のオブジェクトで良い？」→ 駄目。キー順や空白が変わると署名が合わない。フレームワークの JSON パーサより前で生のバイト列を取る。
  - 「比較は == で良い？」→ 先頭から一致する長さで時間が変わる。定数時間比較。
  - 「なぜ t も署名に含める？」→ 含めないと攻撃者が t だけ新しくして古い要求を再送できる。
  - 「300 秒以内の再送は？」→ 署名だけでは防げない。event id を一定期間記録する。
  - 「未来のタイムスタンプは？」→ 時計ずれを考えて同じ幅で許すが、それを超えたら拒否。
- ヒントの出し順: (1) 「署名を作った側はどのバイト列に署名しましたか」 (2) 「攻撃者が 1 時間前の本物の要求を録っていたら？」 (3) 「文字列の比較にかかる時間は中身によって変わりますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: ヘッダを `,` で分割し `k=v` に分け、`t` を 1 つ（整数）、`v1` を 0 個以上集める。`t` が無い・整数でない・`v1` が 0 個なら `malformed_header`。次に `abs(now - t) > 300` なら `timestamp_out_of_range`（署名計算より先に弾けば無駄な計算も減る）。`signed = f"{t}.".encode() + raw_body` に対して各 secret で HMAC-SHA256 を計算し、各 `v1` と `hmac.compare_digest` で比べて 1 つでも一致すれば OK、無ければ `signature_mismatch`。最後に JSON として解釈し、失敗なら `invalid_payload`。

**別解 A: 署名検証を HTTP ミドルウェアにする**。ルーティングの前で生のボディを読み、検証済みのイベントだけをハンドラに渡す。検証漏れのエンドポイントが生まれにくいが、フレームワークの body パーサとの順序（生のボディを残す設定）に注意が要る。

**別解 B: 署名ではなく取りに行く（fetch-back）**。Webhook の中身を信用せず、イベント ID だけ受け取って決済サービスの API に問い合わせ直す。署名鍵の管理が不要で改ざんの心配も無いが、API 呼び出しが増え、相手の API が落ちていると処理できない。高額な処理では署名検証と併用することもある。
