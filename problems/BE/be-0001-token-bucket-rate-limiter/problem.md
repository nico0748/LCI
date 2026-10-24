---
id: be-0001
slug: token-bucket-rate-limiter
title: Token Bucket レートリミッタ
category: BE
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: [rate_limit]
  security: []
  talk_focus: [requirements_clarify, tradeoff, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: rate_limiter.py
    language: python
    content_ref: starter/python/rate_limiter.py
  - path: rate_limiter.ts
    language: typescript
    content_ref: starter/typescript/rate_limiter.ts
talking_points:
  - id: tp1
    text: capacity がバースト許容量、refill_per_sec が平均レートだと 2 つのパラメータの役割を分けて説明する
    weight: 3
  - id: tp2
    text: タイマーで全キーを補充せず、アクセス時に経過時間から tokens を計算する遅延補充で O(1) にする
    weight: 3
  - id: tp3
    text: 時刻 now を引数で受け取りテスト可能にし、本番では単調時計（time.monotonic / performance.now）を渡す
    weight: 2
  - id: tp4
    text: キーごとの Map が無限に増えるので、満タンに戻ったキーの削除や件数上限に触れる
    weight: 1
  - id: tp5
    text: 複数プロセスやサーバー台数が増えたら Redis などの共有ストアで原子的に更新する必要がある
    weight: 1
requirements:
  - id: burst
    label: 新しいキーは capacity 回まで連続で許可され、それを超えると拒否される
  - id: refill
    label: 時間が経つと refill_per_sec の速さで許可回数が回復し、capacity を超えて貯まらない
  - id: per_key
    label: キーごとに独立して制限される
  - id: retry_after
    label: 拒否された呼び出し元に、あと何秒待てばよいかを返せる
  - id: robust_clock
    label: 時刻が巻き戻っても許可回数が増えたり例外になったりしない
  - id: invalid_config
    label: capacity や refill_per_sec が正でない設定は生成時に拒否される
rubric_hints:
  correctness: "全テスト通過で合格。burst/refill/per_key の 3 つが通れば最低ライン"
  explanation: "固定ウィンドウとの比較（窓の境界で 2 倍通る問題）を自分から出せれば加点。tp2 の遅延補充を『なぜタイマーにしないか』まで言えると高評価"
  time_management: "10 分時点で allow が単一キーで動いていること。retry_after は後回しでよいと宣言できれば可"
  red_flags:
    - "time.time() / Date.now() を関数内で直接読んでいてテストで時刻を制御できない"
    - "拒否された呼び出しでもトークンを減らしている"
    - "経過時間を足すときに capacity で頭打ちにしていない"
  checklist: []
reference_solutions:
  python: solutions/python/rate_limiter.py
  typescript: solutions/typescript/rate_limiter.ts
source:
  origin: "04 §2.2 BE 代表例（レートリミッタ）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "浮動小数点の誤差は 1e-9 の許容で比較している。整数ミリ秒で持つ別解も通る"
---

## 問題文

API サーバーの前段に置くレートリミッタを token bucket 方式で作ってください。

`RateLimiter(capacity, refill_per_sec)` を生成し、`allow(key, now)` が「この呼び出しを通してよいか」を真偽値で返します。`key` はユーザー ID などの文字列、`now` は秒単位の時刻です。

- 新しい key は `capacity` 回まで連続で通ります。使い切ったら拒否します。
- 時間が経つと `refill_per_sec` の速さで回復しますが、`capacity` より多くは貯まりません。
- 拒否された側に「あと何秒待てばよいか」を返す `retry_after(key, now)` も作ってください（今通れるなら 0）。

設計を説明しながら書いてください。

## 制約

- 標準ライブラリのみ。Python は `rate_limiter.py`、TypeScript は `rate_limiter.ts` を編集する。
- Python: `class RateLimiter` に `allow(key: str, now: float) -> bool` と `retry_after(key: str, now: float) -> float`。
- TypeScript: `export class RateLimiter` に `allow(key: string, now: number): boolean` と `retryAfter(key: string, now: number): number`。
- `capacity` は正の整数、`refill_per_sec` は正の数。それ以外は Python では `ValueError`、TypeScript では `Error` を投げる。
- 1 回の `allow` はトークンを 1 つ消費する。拒否された呼び出しは消費しない。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初の 1 分: capacity と refill の役割の違い（バーストと平均）を言語化できるか。固定ウィンドウとの違いを聞かれたら「窓の境界で 2 倍通る」と答えられるとよい。
- 想定質問と答え:
  - 「時刻はどう扱う？」→ 引数で受け取る。本番は単調時計。壁時計は NTP 補正で戻ることがある。
  - 「全キーを毎秒補充する？」→ しない。最後に触った時刻と残量だけ持ち、次のアクセス時に経過時間分を足す。
  - 「メモリは？」→ 満タンに戻ったキーは消しても挙動が変わらない。件数上限や定期掃除。
  - 「複数台なら？」→ Redis の Lua スクリプトや INCR + 期限で原子的に。
- ヒントの出し順: (1) 「各キーについて覚えておくべき値は何個ですか」 (2) 「前回から何秒経ったか分かれば、今の残量は計算できますね」 (3) 「拒否のときに残量を減らしていませんか」。
- 時刻の逆行は聞かれなければ触れなくてよいが、言及できれば加点。

## 振り返り用解説（終了後のみ表示）

**想定解答**: キーごとに `{tokens, last}` を Map に持つ。`allow` では `elapsed = max(0, now - last)` を計算し、`tokens = min(capacity, tokens + elapsed * refill)`、`last = max(last, now)` に更新してから、`tokens >= 1` なら 1 減らして許可する。`retry_after` は同じ補充計算をしたうえで `(1 - tokens) / refill`（0 未満なら 0）。補充をアクセス時にまとめて行う「遅延補充」により、キー数に関係なく 1 呼び出し O(1)。

**別解 A: 固定ウィンドウカウンタ**。`floor(now / window)` ごとに回数を数える。実装は最も簡単で Redis の `INCR` + `EXPIRE` と相性がよいが、窓の境界をまたぐと最大 2 倍通る。バーストを許したくない API には不向き。

**別解 B: スライディングログ / GCRA**。許可した時刻の列を持つスライディングログは正確だがメモリが O(上限回数)。GCRA（Generic Cell Rate Algorithm）は「次に許可できる理論時刻」1 つだけを持つ方式で、token bucket と等価な制限を値 1 つで表せる。値が少ないので共有ストアでの原子的更新がしやすい。
