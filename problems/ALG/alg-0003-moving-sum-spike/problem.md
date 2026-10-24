---
id: alg-0003
slug: moving-sum-spike
title: アクセス数の移動合計で急増を検出
category: ALG
tier: core
difficulty: L1
time_limit: 15
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: []
  security: []
  talk_focus: [complexity, requirements_clarify, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: main.py
    language: python
    content_ref: starter/python/main.py
  - path: main.ts
    language: typescript
    content_ref: starter/typescript/main.ts
talking_points:
  - id: tp1
    text: 窓ごとに K 個を足し直す O(NK) は N=2×10^5, K=10^5 で間に合わないので、スライディングウィンドウで O(N) にする
    weight: 3
  - id: tp2
    text: 窓を 1 つ進めるときは新しい A_i を足して A_{i-K} を引くだけで、合計を更新できる
    weight: 2
  - id: tp3
    text: 合計は最大 2×10^14 になるので 32bit 整数ではあふれる（C/Go は int64、JS の Number は 2^53 まで正確）
    weight: 2
  - id: tp4
    text: 閾値は「超える」（> T）で、ちょうど T は含まないこと、K = N の窓が 1 つだけの場合を確認する
    weight: 1
requirements:
  - id: first
    label: 直近 K 分の合計が閾値を超えた最初の分を答える
  - id: count
    label: 閾値を超えた窓の数を答える
  - id: none
    label: 一度も超えなければ -1 と 0 を答える
  - id: fast
    label: N = 2×10^5 でも制限時間内に答える
rubric_hints:
  correctness: "全ケース AC で合格。大きいケースで TLE なら O(NK) のまま"
  explanation: "O(NK) → O(N) の改善を、窓をずらすときの差分（足して引く）として説明できるか。tp3 のオーバーフローに触れれば加点"
  time_management: "5 分で素朴解の方針、10 分でスライディングウィンドウが動いていること"
  red_flags:
    - "毎回 sum(A[i-K:i]) を計算している"
    - "≥ と > を取り違えて境界のケースを落とす"
  checklist: []
reference_solutions:
  python: solutions/python/main.py
  typescript: solutions/typescript/main.ts
source:
  origin: "LCI オリジナル（監視ダッシュボードのアラート条件を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

サービスの監視で「直近 K 分間のアクセス数の合計が T を超えたらアラート」というルールを入れたいです。過去 N 分ぶんの 1 分ごとのアクセス数が与えられるので、最初にアラートが出る分と、アラート条件を満たす分が全部で何回あるかを答えてください。

i 分目の時点の「直近 K 分」とは i-K+1 分目から i 分目までで、i が K 未満の分はまだ判定しません。

## 制約

入力:

```
N K T
A_1 A_2 … A_N
```

出力: 条件（A_{i-K+1} + … + A_i > T）を満たす最小の i（1 始まり）と、条件を満たす i の個数を空白区切りで 1 行。満たす i が無ければ `-1 0`。

- 1 ≤ K ≤ N ≤ 2×10^5
- 0 ≤ A_i ≤ 10^9、0 ≤ T ≤ 10^15、すべて整数
- 制限時間 2 秒（Python は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します
- 設問者への質問は OK。Web 検索は不可。

入力例:

```
6 3 10
1 5 3 4 6 0
```

出力例: `4 2`（4 分目 5+3+4=12、5 分目 3+4+6=13 が 10 を超える。6 分目は 4+6+0=10 で超えない）

## 面接官メモ（非公開）

- 15 分のウォームアップ。素朴解を先に言ってから計算量を見積もり、改善する流れを話せるかを見る。
- 想定質問と答え:
  - 「T ちょうどは？」→ 超えない（> T）。
  - 「i < K の分は？」→ 判定しない。
  - 「合計の型は？」→ 最大 2×10^5 × 10^9 = 2×10^14。int32 ではあふれる。
- ヒントの出し順: (1) 「N と K が最大のとき、足し算は何回になりますか」 (2) 「i 分目の窓と i+1 分目の窓は、何が違いますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: 最初の K 個の合計 `s` を作り、i = K で判定。以降 i = K+1 … N について `s += A_i - A_{i-K}` で更新して判定する。最初に `s > T` となった i と、その回数を数える。O(N) 時間・O(1) 追加メモリ（入力の保持を除く）。

**別解 A: 累積和**。`P_0 = 0, P_i = P_{i-1} + A_i` を作れば、窓の合計は `P_i - P_{i-K}`。O(N) メモリを使うが、「任意の区間の合計」に一般化しやすく、窓の幅が問い合わせごとに変わる場合にも使える。

**別解 B: ストリーム処理（リングバッファ）**。入力を全部持たずに、直近 K 個だけを長さ K のリングバッファに入れて合計を更新する。監視システムのように値が 1 分ごとに届く実運用ではこちらの形になる。メモリは O(K)。
