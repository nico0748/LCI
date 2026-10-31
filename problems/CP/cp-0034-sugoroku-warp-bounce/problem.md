---
id: cp-0034
slug: sugoroku-warp-bounce
title: "すごろくのワープと跳ね返り"
category: CP
tier: core
difficulty: L1
time_limit: 20
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [requirements_clarify, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "1 回の出目で行う処理を、順番に言ってみてください"
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
    text: N ≤ 100、K ≤ 100 なので 1 投ずつのシミュレーションで十分（100 回）。計算量ではなく「1 投の処理の順序」が勝負と宣言する
    weight: 3
  - id: tp2
    text: 1 投の処理を「進む → 越えたら pos = N − (pos − N) で戻る → pos == N ならゴールで終了 → ワープ表を 1 回だけ引く」の順に固定する
    weight: 3
  - id: tp3
    text: ワープは入口→出口の配列（または辞書）で持ち、while ではなく if で 1 回だけ適用する。出口が別の入口でも続けて飛ばない
    weight: 2
  - id: tp4
    text: 戻った先がワープの入口、N を越えたがちょうどではない（ゴールではない）、ゴール後に出目が残っている、ワープ 0 個（M=0）を列挙する
    weight: 1
  - id: tp5
    text: 出力は「GOAL t」か最後のマス番号の 2 通り。入力例 1 を 1 投ずつ手で追い、ゴール後に出目が余る入力も自作して試す
    weight: 1
requirements:
  - id: correct_output
    label: ゴールしたら GOAL と何投目か、しなければ最後のマス番号を出力する
  - id: bounce_then_warp
    label: N を越えた分だけ戻り、戻った先がワープの入口ならワープする（ワープは 1 回の移動で 1 回だけ）
  - id: stop_at_goal
    label: ちょうど N に止まったときだけゴールとし、その後の出目は使わない
rubric_hints:
  correctness: "hidden-trap-bounce-warp・hidden-trap-exact-goal・hidden-trap-after-goal・hidden-trap-warp-chain がそれぞれ 1 つの読み落としに対応する。全部通れば合格"
  explanation: "書く前に 1 投の処理順（進む・戻る・ゴール判定・ワープ）を言葉で宣言できれば加点"
  time_management: "5 分で処理順を宣言し、12 分以内に入力例 1・2 が通る"
  red_flags:
    - "ワープを while で繰り返し適用して、出口が別の入口のときに連続で飛ぶ"
    - "pos ≥ N をゴールにして、N を越えて戻るべき場面でゴール扱いにする"
    - "ゴールしても break せずに残りの出目で動かし続ける"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 規則つきシミュレーション / 題材: ワープと跳ね返りのあるすごろく）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: すごろく・蛇と梯子型のシミュレーションは定番。跳ね返り＋ワープ 1 回限り＋ゴール後の出目を無視、の組み合わせで差別化している"
---

## 問題文

マス 0（スタート）からマス N（ゴール）までが一列に並んだすごろくがあります。コマはマス 0 から始め、出目 d_1, d_2, …, d_K の順に、1 回ずつ次のように動かします。

1. 出目の数だけ進みます。マス N を越える場合は、越えた分だけ戻ります（例: N = 10 でマス 8 から 5 を出すと、マス 7 に止まります）。
2. 止まったマスがちょうど N ならゴールです。残りの出目は使いません。
3. 止まったマス（戻った場合は戻った先）がワープの入口なら、出口のマスへ移ります。出口が別のワープの入口でも、続けてワープはしません。

ゴールした場合は何回目の出目でゴールしたかを、ゴールしなかった場合は最後にいるマスの番号を出力してください。

## 制約

入力:

```
N K
d_1 d_2 … d_K
M
s_1 t_1
⋮
s_M t_M
```

M はワープの数で、j 番目のワープはマス s_j（入口）からマス t_j（出口）へ移ります。

出力: ゴールした場合は `GOAL t`（t は何回目の出目でゴールしたか）、しなかった場合は最後にいるマスの番号（最後に改行を付ける）

- 6 ≤ N ≤ 100
- 1 ≤ K ≤ 100
- 1 ≤ d_i ≤ 6
- 0 ≤ M ≤ N − 1
- 1 ≤ s_j ≤ N − 1、0 ≤ t_j ≤ N − 1、s_j ≠ t_j
- s_j はすべて異なる
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
10 4
3 5 4 6
2
3 8
9 2
```

出力例 1:

```
8
```

入力例 2:

```
6 4
4 2 5 1
0
```

出力例 2:

```
GOAL 2
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「越えて戻った先がワープの入口だったら、ワープしますか」→ する（問題文 3 の「戻った場合は戻った先」）。入力例 1 の 3 投目がその例（9 に戻ってワープで 2 へ）。
  - 「ワープの出口がゴールになることはありますか」→ ない（t_j ≤ N − 1）。
  - 「N を越えたら、それだけでゴールですか」→ ちょうど止まったときだけ。
- 入力例 1 の流れ: 0 →(3) 3 → ワープで 8 →(5) 13 は越えるので 7 →(4) 11 は越えるので 9 → ワープで 2 →(6) 8。8 は出口であって入口ではないのでそのまま。
- ヒントの出し順:
  1. 「1 投で起きることを、起きる順に 3 つ書き出してみてください」
  2. 「ワープを while で書いていませんか。出口が別の入口のとき、問題文はどう言っていますか」
  3. 「ゴールした瞬間にループを抜けていますか。入力例 2 の 3 投目以降はどうなりますか」
- 計算量は問わない（最大 100 投）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: ワープ表を「入口 → 出口」の配列（大きさ N、無ければ −1）か辞書で作り、出目を 1 つずつ処理します。`pos += d` のあと `pos > N` なら `pos = N − (pos − N)`（= 2N − pos）。`pos == N` なら `GOAL t` を出して終了します。そうでなければ、`pos` が入口なら出口に移します（if で 1 回だけ）。最後まで使い切ったら `pos` を出力します。O(K + M) です。

**素朴解が落ちる理由**: 計算量の罠はありません。落ちるのは規則の順序の取り違えです。(1) ワープを `while` で繰り返すと、出口が入口のときに連続で飛んでしまう（hidden-trap-warp-chain）。(2) `pos >= N` をゴールにすると、越えて戻る場面をゴール扱いにする（hidden-trap-exact-goal）。(3) ゴール後に break しないと、残りの出目で動いてしまう（hidden-trap-after-goal）。(4) 戻る処理の後でワープを確かめないと、戻った先のワープを逃す（hidden-trap-bounce-warp）。

**別解**: 1 マスずつ進め、N に着いた時点で歩数が残っていれば向きを反転する、という素直なシミュレーションでも同じ結果になります（d ≤ 6 なので遅くならない）。N ≥ 6 なので、マス N − 1 から 6 を出しても戻った先は N − 5 ≥ 1 で、0 より下には行きません。

**言語別の注意**:
- 出力が「`GOAL t`」と「数値」の 2 通りあるので、関数から返すより、その場で出力して return / exit する方が書き間違いが少ない。
- M = 0 のときはワープの行が 1 つも無い。1 行ずつ読む書き方では、M の行の後に何も無いことを前提にする。
- C: ワープ表は `int warp[101]` を −1 で初期化しておく（`memset(warp, -1, sizeof warp)` が使える）。
- Python: `dict.get(pos, pos)` で「入口でなければそのまま」が 1 行で書ける。
