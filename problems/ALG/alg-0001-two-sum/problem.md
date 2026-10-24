---
id: alg-0001
slug: two-sum
title: Two Sum（和が K になる 2 要素）
category: ALG
tier: core
difficulty: L1
time_limit: 15
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [atcoder]
  nfr: [complexity]
  security: []
  talk_focus: [complexity, edge_cases]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: main.py
    language: python
    content_ref: starter/main.py
  - path: main.ts
    language: typescript
    content_ref: starter/main.ts
talking_points:
  - id: tp1
    text: 全探索 O(N^2) を先に示し、N=2×10^5 では間に合わないと見積もる
    weight: 2
  - id: tp2
    text: ハッシュマップで「K - a を見たか」を記録し O(N) にする
    weight: 3
  - id: tp3
    text: 同じ要素を 2 回使わないよう、参照してから登録する順序にする
    weight: 2
  - id: tp4
    text: 解が無いときは -1 を出力する、複数解なら最小の j、次に最小の i を選ぶ
    weight: 1
requirements:
  - id: correct_pair
    label: 和が K になる添字 i < j を 1 組出力する（無ければ -1）
  - id: tie_break
    label: 複数ある場合は j が最小、その中で i が最小の組を選ぶ
  - id: linear_time
    label: N=2×10^5 で制限時間内に終わる計算量になっている
  - id: no_self_pair
    label: 同じ要素を 2 回使わない
rubric_hints:
  correctness: "hidden の大きいケースで TLE しないこと。tie-break を読み落とすと WA"
  explanation: "計算量を O(N^2) → O(N) と言語化し、ハッシュの最悪ケースにも触れられれば加点"
  time_management: "5 分以内に方針を宣言、10 分以内にサンプル AC"
  red_flags:
    - "計算量を言わずに二重ループを書き始める"
    - "同じ添字を 2 回使うバグに気づかない"
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（定番問題の標準入出力版）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

長さ N の整数列 A_1, …, A_N と整数 K が与えられます。
A_i + A_j = K となる添字の組 (i, j)（1 ≤ i < j ≤ N）を 1 組出力してください。

- 条件を満たす組が複数ある場合は、**j が最小**のもの、その中で **i が最小**のものを出力してください。
- 存在しない場合は `-1` を出力してください。

入力:

```
N K
A_1 A_2 … A_N
```

出力: `i j`（1 始まり、空白区切り）または `-1`

入力例 1:

```
4 9
2 7 11 15
```

出力例 1:

```
1 2
```

## 制約

- 2 ≤ N ≤ 2×10^5
- -10^9 ≤ A_i, K ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）

## 面接官メモ（非公開）

- 最初に計算量の見積もり（N=2×10^5 なので O(N^2) は 4×10^10 で不可）を口にするか。
- 「参照してから登録」の順序の理由（自分自身とペアにしない）を説明できるか。
- tie-break（j 最小 → i 最小）: 左から走査し、値ごとに**最初に現れた添字**だけを保持すれば自然に満たせる。
- 和が 32bit を超える言語（C/Go/Rust）でのオーバーフローに触れるか（-2×10^9 ≤ 和 ≤ 2×10^9 は int32 を超える）。

## 振り返り用解説（終了後のみ表示）

左から j = 1..N の順に見て、`need = K - A_j` がハッシュマップに既にあれば `(map[need], j)` を出力して終了します。
無ければ `A_j` が未登録のときだけ `map[A_j] = j` を登録します（最初の出現を残すと i が最小になる）。
j の昇順に走査しているので、最初に見つかった組が j 最小、その時点で保持している添字が i 最小です。
時間 O(N)、空間 O(N)。
