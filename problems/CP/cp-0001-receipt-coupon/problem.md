---
id: cp-0001
slug: receipt-coupon
title: "レシートの合計とクーポン"
category: CP
tier: core
difficulty: L1
time_limit: 15
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "小計がちょうど X 円のときと、クーポンの額が小計より大きいときはどうなりますか"
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
    text: "N ≤ 100 なので計算量は問題にならないと先に言い切り、代わりに金額の上限（小計 S ≤ 100×5000×20 = 10^7、T×11 ≤ 1.1×10^8）が int32 に収まることを確認する"
    weight: 3
  - id: tp2
    text: "税を T × 1.1 の浮動小数で計算する素朴な書き方の危険（四捨五入や printf の %.0f で丸める、996.6 のように小数のまま出力する）を挙げ、整数の T + T × 10 / 100（整数除算）にする"
    weight: 2
  - id: tp3
    text: "手順の順序を確定させる: 小計 S → 「S ≥ X」ならクーポン（S = X でも使える）→ max(S − Y, 0) → その T にだけ税を掛ける"
    weight: 3
  - id: tp4
    text: "提出前に S = X、S = X − 1、Y > S（支払額 0）、T が 10 の倍数でない（切り捨てが効く）の 4 つを試す"
    weight: 1
  - id: tp5
    text: "1 行目の N X Y と、続く N 行の「品名 単価 個数」を読み、品名は文字列として読み飛ばす。サンプル以外に S = X の入力を自作して確かめる"
    weight: 1
requirements:
  - id: correct_payment
    label: "小計 → クーポン → 消費税（切り捨て）の順に計算した支払額を出力する"
  - id: coupon_boundary
    label: "小計がちょうど X 円ならクーポンを適用し、X − 1 円なら適用しない"
  - id: clamp_zero
    label: "クーポンを引いた結果が負になるときは 0 円として扱い、支払額 0 を出力する"
  - id: integer_tax
    label: "消費税を 1 円未満切り捨てで計算し、支払額を小数点なしの整数で出力する"
rubric_hints:
  correctness: "hidden-trap-boundary-equal*（S = X）、hidden-trap-negative*（Y ≥ S）、hidden-trap-tax-round と hidden-trap-tax-integer（切り捨てと整数出力）がすべて通れば合格"
  explanation: "コードを書く前に、手順の順序と 3 つの境界（以上・0 円で止める・切り捨て）を言葉で確認できれば加点。浮動小数を避ける理由を言えればさらに加点"
  time_management: "3 分で手順と境界を確認し、8 分でサンプル 2 件が通り、残りで S = X と Y > S の入力を自作して試す"
  red_flags:
    - "「X 円以上」を S > X と書いて、小計がちょうど X 円のときにクーポンを使わない"
    - "T * 1.1 を四捨五入（round や printf の %.0f）したり、小数のまま出力したりする"
    - "割引後の金額を 0 で止めずに負の支払額を出す"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 条件分岐・整数演算 / 題材: 雑貨店のレジでのクーポンと消費税）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

ある雑貨店のレジでは、買い物の小計にクーポンを適用してから消費税を加えて、支払額を決めます。

N 種類の品目について、品名・単価 P_i 円・個数 Q_i が与えられます。次の手順で支払額を求めて出力してください。

1. 小計 S = P_1 × Q_1 + P_2 × Q_2 + … + P_N × Q_N を求める。
2. S が **X 円以上**なら、クーポンで Y 円を引く。引いた結果が 0 円未満になる場合は 0 円とする。S が X 円未満ならクーポンは使えない。
3. 手順 2 の後の金額を T 円とする。消費税は T × 10 / 100 円の **1 円未満を切り捨てた**額で、支払額は T にこの消費税を加えた額である。

## 制約

入力:

```
N X Y
name_1 P_1 Q_1
name_2 P_2 Q_2
…
name_N P_N Q_N
```

出力: 支払額を整数で 1 行に出力してください（最後に改行を付ける）。

- 1 ≤ N ≤ 100
- name_i は英小文字からなる 1 文字以上 10 文字以下の文字列
- 1 ≤ P_i ≤ 5000、1 ≤ Q_i ≤ 20
- 1 ≤ X ≤ 10^7、1 ≤ Y ≤ 10^7
- name_i 以外の入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 1000 100
apple 120 3
milk 198 2
bread 250 1
```

出力例 1:

```
996
```

小計は 360 + 396 + 250 = 1006 円で 1000 円以上なので、100 円引いて 906 円です。消費税は 90.6 円の 1 円未満を切り捨てた 90 円で、支払額は 996 円です。

入力例 2:

```
2 3000 500
notebook 280 5
pen 110 4
```

出力例 2:

```
2024
```

小計 1840 円は 3000 円未満なのでクーポンは使えません。消費税 184 円を加えて 2024 円です。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「小計がちょうど X 円なら使えますか」→ 使えます（X 円**以上**）。
  - 「クーポンの額が小計より大きいことはありますか」→ あります。そのときは 0 円で止め、税も 0 円です（支払額 0）。
  - 「消費税は割引前の小計に掛けますか」→ いいえ、割引後の T に掛けます。
  - 「品名は使いますか」→ 使いません。読み飛ばしてよいです。
- 見たいこと: 書き始める前に手順の順序と境界を口にするか。税を浮動小数で計算しようとしたら、その理由と危険を説明できるか。
- ヒントの出し順:
  1. 「問題文の 3 つの手順それぞれに、境界になる値はありますか」
  2. 「T × 1.1 は小数になりえます。整数だけで切り捨てを書けませんか」
  3. 「S = X の入力と、Y が S より大きい入力を作って試してみましょう」
- 類題について: 「金額に割引と税を適用する」実装問題は一般的な題材。特定の既存問題の文面・数値は使っていない。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 単価 × 個数を足して小計 S を作り、`S >= X` のときだけ `T = max(S - Y, 0)`、そうでなければ `T = S` とします。支払額は `T + T * 10 / 100`（整数除算）です。時間 O(N)、空間 O(1)。

**素朴解が落ちる理由**: 計算量の罠はありません。落ちるのは次の 3 つです。

- `S > X` と書いてしまう（hidden-trap-boundary-equal）。
- 割引後を 0 で止めない（hidden-trap-negative）。
- 税を浮動小数で計算して丸め方を誤る。`printf("%.0f", t * 1.1)` や `round(t * 1.1)` は四捨五入なので、T = 1999 で 2199 になります（正しくは 2198。hidden-trap-tax-round）。Python の `print(t * 1.1)` や JavaScript の `t * 1.1` をそのまま出すと `1375.0000000000002` のような小数が出ます（hidden-trap-tax-integer）。
- この問題の範囲では `floor(t * 1.1)` は結果的に正しくなります。ただし、それは 1.1 が double で 1.1 よりわずかに大きく表されるからにすぎません。税率が 15% なら `20 * 1.15 = 22.999999999999996` で 1 円ずれます。切り捨ては整数演算で書くのが安全です。

**別解**: 税込み額を `T * 110 / 100`（整数除算）で一度に計算してもよいです。この問題の範囲では T × 110 ≤ 1.1×10^9 で、int32 にも収まります。

**言語別の注意**:
- Python: `/` は浮動小数の割り算なので `//` を使う。
- TypeScript / PHP: `/` は浮動小数になる。`Math.floor(t * 10 / 100)` か、PHP なら `intdiv($t * 10, 100)` を使う。
- C / Go / Rust: 整数どうしの `/` は 0 方向への切り捨て。T ≥ 0 なので、そのまま切り捨てになる。
- C: `printf("%.0f")` は四捨五入なので、切り捨てには使えない。
