---
id: cp-0037
slug: budget-longest-span
title: "予算内の最長連続日程"
category: CP
tier: core
difficulty: L2
time_limit: 30
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [atcoder]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "開始日ごとに足していくやり方は、この制約で間に合いますか"
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
    text: N ≤ 2×10^5 なので O(N) か O(N log N) が目標。C で 1 秒に 10^8 回、Python で 10^7 回が目安と宣言する
    weight: 3
  - id: tp2
    text: 素朴解の「開始日ごとに予算を超えるまで右へ足す」は、全日程が予算内だと N^2/2 = 2×10^10 回で TLE（C でも間に合わない）
    weight: 2
  - id: tp3
    text: 費用が 0 以上なので、右端を伸ばすと合計は増え、左端を進めると減る。この単調性で尺取り法が使え、左右の端はそれぞれ N 回しか動かないので O(N)
    weight: 3
  - id: tp4
    text: どの 1 日も B を超える（0 を出力）、最長が複数ある（「>」で更新して最も早い開始日）、0 円の日、予算 B ≤ 10^15 と合計は 64bit、を列挙する
    weight: 1
  - id: tp5
    text: 2×10^5 個の整数をまとめて読む。入力例 1 を手で追い、同じ長さの区間が 2 つある入力を自作して開始日を確かめる
    weight: 1
requirements:
  - id: correct_output
    label: 予算 B 以下で借りられる連続日数の最大と、その中で最も早い開始日を出力する（1 日も借りられなければ 0）
  - id: tie_and_edges
    label: 最長の区間が複数あるときは最も早い開始日を選び、0 円の日を含む入力でも正しい
  - id: wide_integers
    label: 予算と合計（最大 10^15 と 2×10^14）を 64bit 整数で扱う
  - id: within_limit
    label: N=2×10^5 で制限時間内に終わる（O(N^2) にしない）
rubric_hints:
  correctness: "hidden-max-*（O(N^2) の TLE）、hidden-trap-earliest-start（≥ で更新）、hidden-trap-int64（予算の 32bit 読み込み）、入力例 2（0 の出力）が通れば合格"
  explanation: "尺取り法が正しい理由（費用が非負なので、ある右端で予算内の最小の左端は右端とともに単調に進む）と、各ポインタが N 回しか動かないことを説明できれば加点"
  time_management: "8 分で尺取り法を宣言し、18 分以内に入力例 1・2 が通る"
  red_flags:
    - "計算量を言わずに開始日と終了日の二重ループを書き始める"
    - "最長の更新を「≥」で行い、同じ長さの区間のうち最後の開始日を出力する"
    - "予算 B（最大 10^15）を 32bit の int で読み込み、値が壊れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 尺取り法（2 ポインタ） / 題材: 予算内でイベント会場を連続して借りる日程）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「和が B 以下の最長の連続部分列」は尺取り法の定番。0 円の日・最も早い開始日・1 日も借りられない場合の 0 を加えている"
---

## 問題文

イベント会場を、連続した何日かだけ借りることにしました。候補の期間は N 日間で、i 日目の利用料は a_i 円です（休館日の扱いで 0 円の日もあります）。

l 日目から r 日目まで（l ≤ r）を続けて借りると、利用料の合計は a_l + a_{l+1} + … + a_r 円です。合計が予算 B 円以下になるように借りるとき、借りられる日数の最大値を求めてください。また、その日数で借りられる日程のうち、開始日 l が最も早いものの l も求めてください。

どの 1 日の利用料も B 円を超えていて、1 日も借りられない場合は `0` とだけ出力してください。

## 制約

入力:

```
N B
a_1 a_2 … a_N
```

出力: 日数の最大値と最も早い開始日を空白区切りで出力する（最後に改行を付ける）。1 日も借りられない場合は `0`。

- 1 ≤ N ≤ 2×10^5
- 1 ≤ B ≤ 10^15
- 0 ≤ a_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
7 10
3 1 4 1 5 9 2
```

出力例 1:

```
4 1
```

入力例 2:

```
3 5
6 7 8
```

出力例 2:

```
0
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「同じ日数の日程が複数あったら」→ 開始日が最も早いもの。
  - 「利用料が 0 円の日はありますか」→ ある。負の日は無い。
  - 「予算ちょうどは借りられますか」→ 借りられる（B 以下）。
- 入力例 1: 1〜4 日目は 3+1+4+1 = 9 で 4 日。5 日以上の区間はどれも 10 を超える。
- ヒントの出し順:
  1. 「開始日ごとに足していくと、最悪で何回足しますか」
  2. 「右端を 1 つ伸ばしたとき、予算内に収まる最も左の開始日は、前より左に戻ることがありますか」
  3. 「左右 2 つの位置だけを動かして、合計を足し引きで保ってみましょう」
- 別解（累積和＋二分探索 O(N log N)）でも満点。その場合は累積和が 2×10^14 になることに触れるか。

## 振り返り用解説（終了後のみ表示）

**想定解答（尺取り法）**: 左端 l = 0、合計 s = 0 から始め、右端 r を 0 から N − 1 まで 1 つずつ進めます。`s += a[r]` のあと、`s > B` の間は `s -= a[l]; l++` で左端を進めます。このときの区間 [l, r] が「右端 r で予算内に収まる最長の区間」で、長さ r − l + 1 がそれまでの最長より**真に長いとき**だけ (長さ, l + 1) を記録します。同じ長さなら先に見つかった方が開始日が早いので、`>` で更新すれば最も早い開始日が残ります。l も r も N 回しか進まないので O(N) です。

費用が 0 以上なので「右端を伸ばすと合計は減らない、左端を進めると合計は増えない」が成り立ち、予算内の最小の左端は右端とともに単調に進みます。これが尺取り法の正しさの根拠です（負の費用があると成り立たない）。

**素朴解が落ちる理由**: 開始日ごとに予算を超えるまで右へ足す方法は O(N^2) で、全日程が予算内の hidden-max-all-fit では N^2/2 = 2×10^10 回の加算になり、C でも間に合いません。

**別解**: 累積和 S を作ると S は単調非減少なので、各開始日 l について `S[r] − S[l−1] ≤ B` を満たす最大の r を二分探索で求められます（O(N log N)）。

**言語別の注意**:
- C / Go / Rust: B（最大 10^15）と合計 s は 64bit。`scanf("%lld")` / `int64` / `i64` で読む。
- TypeScript: 10^15 と 2×10^14 はどちらも 2^53（約 9×10^15）より小さいので Number で正確に扱える。
- Python / PHP: 2×10^5 回のループは間に合う。入力は一度に読んでから分割する。
- 出力は「日数 開始日」と「0」の 2 通り。長さ 0 のときに `0 0` と出さない。
