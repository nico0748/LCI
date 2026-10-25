---
id: cp-0036
slug: cold-cargo-knapsack
title: "冷蔵品つきの積み込み"
category: CP
tier: core
difficulty: L3
time_limit: 45
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "荷物の選び方を全部試すと何通りになりますか"
  - silence_sec: 90
    text: "今どこで迷っていますか"
web_search: false
allow_questions: true
starter_files:
  - path: main.c
    language: c
    content_ref: starter/c/main.c
  - path: main.rs
    language: rust
    content_ref: starter/rust/main.rs
  - path: main.py
    language: python
    content_ref: starter/python/main.py
  - path: main.go
    language: go
    content_ref: starter/go/main.go
  - path: main.ts
    language: typescript
    content_ref: starter/typescript/main.ts
  - path: main.php
    language: php
    content_ref: starter/php/main.php
talking_points:
  - id: tp1
    text: N ≤ 100、W ≤ 2000、C ≤ 5 なので、状態を「重さ × 冷蔵品の個数」にした DP は N×(W+1)×(C+1) ≈ 1.2×10^6 回。Python でも間に合うと宣言する
    weight: 3
  - id: tp2
    text: 素朴解の全探索は 2^100 通りで不可能。報酬/重さの比で貪欲に積む方法は速いが、上限を中途半端に埋めて WA（入力例 1 では 80 になり、正解は 95）
    weight: 2
  - id: tp3
    text: dp[c][w] = 冷蔵品 c 個以下・重さ w 以下での報酬の最大。冷蔵品は dp[c−1][w−w_i] から、通常品は dp[c][w−w_i] から足す 0/1 ナップサック
    weight: 3
  - id: tp4
    text: 1 次元配列を重さの昇順に更新すると同じ荷物を何度も使う（降順に回すか前の表から作る）、C=0、W より重い荷物、何も積めない（0）、合計は 10^11 で 64bit、を列挙する
    weight: 1
  - id: tp5
    text: 入力は 3N+3 個の整数をまとめて読む。入力例 1 で貪欲が負けることを確かめ、同じ荷物を 2 回使うと得をする入力（W=10 に重さ 5）を自作して試す
    weight: 1
requirements:
  - id: correct_output
    label: 重さの合計 W 以下・冷蔵品 C 個以下で積める荷物の報酬の合計の最大値を出力する（何も積めなければ 0）
  - id: zero_one
    label: 各荷物を高々 1 回しか使わず、冷蔵品の個数制限（C=0 を含む）を守る
  - id: wide_integers
    label: 報酬の合計（最大約 10^11）を 64bit 整数で扱う
  - id: within_limit
    label: N=100、W=2000、C=5 で制限時間内に終わる（全探索しない）
rubric_hints:
  correctness: "hidden-trap-reuse-item（同じ荷物の重複使用）・hidden-trap-cold-limit / c-zero（冷蔵の制約）・hidden-trap-greedy-ratio・hidden-trap-int64 が通れば合格"
  explanation: "状態に冷蔵品の個数を足す理由と、更新の向き（重さの降順・冷蔵の降順）で 0/1 を保つ理由を説明できれば加点"
  time_management: "12 分で dp の定義と遷移を宣言し、25 分以内に入力例 1・2 が通る"
  red_flags:
    - "1 次元の dp を重さの昇順に更新し、同じ荷物を何度も使ってしまう（個数制限なしのナップサックになる）"
    - "報酬/重さの比で並べて貪欲に積み、入力例 1 で 80 を出す"
    - "報酬の合計を 32bit の int で持ち、10^9 の荷物を何個も積むと溢れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 0/1 ナップサック DP（重さ × 冷蔵品の個数の 2 次元） / 題材: 冷蔵庫の容量に制限があるトラックの積み込み）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 個数制限つきの 0/1 ナップサックは定番。冷蔵品だけに個数の上限を付けた 2 次元の状態にしている"
---

## 問題文

トラックに、N 個の荷物の中からいくつかを選んで積みます。荷物 i の重さは w_i、運ぶと得られる報酬は v_i です。f_i = 1 の荷物は冷蔵品で、f_i = 0 の荷物は通常品です。

トラックに積める重さの合計は W 以下です。また、冷蔵庫の大きさの都合で、冷蔵品は合計 C 個までしか積めません。各荷物は 1 個ずつしかなく、同じ荷物を 2 回積むことはできません。

積む荷物をうまく選んだときの、報酬の合計の最大値を求めてください。何も積まない場合の報酬は 0 です。

## 制約

入力:

```
N W C
w_1 v_1 f_1
⋮
w_N v_N f_N
```

出力: 報酬の合計の最大値（最後に改行を付ける）

- 1 ≤ N ≤ 100
- 1 ≤ W ≤ 2000
- 0 ≤ C ≤ 5
- 1 ≤ w_i ≤ 2000
- 1 ≤ v_i ≤ 10^9
- f_i は 0 または 1
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 10 1
4 50 1
5 60 1
3 30 0
6 45 0
```

出力例 1:

```
95
```

入力例 2:

```
3 5 0
2 10 1
6 100 0
5 7 0
```

出力例 2:

```
7
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「W より重い荷物はありますか」→ ある（w_i ≤ 2000 で、W より大きいこともある）。その荷物は積めない。
  - 「冷蔵品を積まなくてもいいですか」→ よい。C は上限で、C = 0 なら冷蔵品は 1 つも積めない（入力例 2）。
  - 「重さがちょうど W でないといけませんか」→ W 以下ならよい。
- 入力例 1: 冷蔵品は 1 個まで。荷物 1（4, 50, 冷蔵）と荷物 4（6, 45）で重さ 10・報酬 95 が最大。荷物 1 と 2 は両方冷蔵品なので一緒に積めない。比の大きい順の貪欲（1 → 3 と積む）は 80。
- ヒントの出し順:
  1. 「重さだけの普通のナップサックなら、dp に何を持ちますか」
  2. 「冷蔵品の個数を数えるには、状態に何を足せばいいですか。C ≤ 5 は何のためでしょう」
  3. 「1 次元の配列で書くなら、重さのループはどちら向きに回しますか。同じ荷物を 2 回使っていませんか」
- 計算量の見積もり: 状態数 (C+1)(W+1) ≈ 1.2×10^4、荷物 100 個で 1.2×10^6 回の更新。

## 振り返り用解説（終了後のみ表示）

**想定解答**: `dp[c][w]` を「冷蔵品 c 個以下・重さの合計 w 以下で得られる報酬の最大」とし、すべて 0 で始めます。荷物 (w_i, v_i, f_i) ごとに、通常品なら `dp[c][w] = max(dp[c][w], dp[c][w − w_i] + v_i)`、冷蔵品なら c ≥ 1 について `dp[c][w] = max(dp[c][w], dp[c − 1][w − w_i] + v_i)` と更新します。0/1（各荷物 1 回）を守るため、右辺は「この荷物を使う前」の値でなければなりません。1 つの配列を上書きするなら、w を大きい方から、冷蔵品の c も大きい方から回します。答えは `dp[C][W]` で、計算量は O(N × W × C) ≈ 1.2×10^6 です。

**素朴解が落ちる理由**: 部分集合の全探索は 2^100 通りで終わりません（軽い荷物が多い hidden-max-light-items では、枝刈りしても組合せが爆発する）。報酬/重さの比で貪欲に積む方法は、上限を中途半端に埋めて最適を逃します（入力例 1、hidden-trap-greedy-ratio）。1 次元の dp を w の昇順に更新すると、更新したばかりの値を同じ荷物でまた使い、個数制限なしのナップサックになります（hidden-trap-reuse-item）。

**別解**: 「ちょうど重さ w・ちょうど冷蔵品 c 個」の最大を持ち、到達できない状態を −∞ にしておき、最後に全状態の最大を取る書き方でも同じです。冷蔵品と通常品を分け、それぞれ「個数 × 重さ」の表を作ってから重さを分け合う方法もありますが、手間が増えるだけです。

**言語別の注意**:
- C / Go / Rust: 報酬の合計は最大で約 10^11 なので 64bit（`long long` / `int64` / `i64`）。dp の大きさは 6 × 2001 なので固定長の配列でよい。
- TypeScript: 10^11 は 2^53 より小さいので Number で正確。`Float64Array` で dp を持つと速い。
- Python: 二重ループで書いても 1.2×10^6 回なので間に合うが、行ごとにリスト内包表記で新しい行を作ると、0/1 も自然に守れて速い。
- PHP: 配列の更新は w の降順に回す。整数は 64bit なので溢れない。
