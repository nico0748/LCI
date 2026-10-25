---
id: cp-0007
slug: elevator-no-zero-floor
title: "0 階の無いエレベーター"
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
    text: "B1 から 1 へ動くと、何階分の移動になりますか"
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
    text: "N ≤ 100 なので計算量は問題にならないと言い切り、答えの最大は B3 と 99 の往復 99 回 × 101 階分 = 9999 程度と見積もる"
    weight: 3
  - id: tp2
    text: "素朴な対応づけ（B1 → −1、B2 → −2 と負の数にするだけ）では、0 階が無いのに B1 → 1 が 2 階分になってしまう、と例で示す"
    weight: 2
  - id: tp3
    text: "観察: 地下を 1 つずらして B_k → 1 − k（B1 → 0、B2 → −1、B3 → −2）に写せば、隣り合う停止階の差の絶対値の和がそのまま答えになる"
    weight: 3
  - id: tp4
    text: "エッジ: N = 1（答え 0）、同じ階が続く（0 階分）、B1 と 1 の往復、B3 と 99 の往復（101 階分）、2 桁の階（10〜99）"
    weight: 1
  - id: tp5
    text: "1 行に 1 つの階を文字列として読み、先頭が B かどうかで分ける。2 桁の階を 1 文字目だけで読まない。自作入力 B1 → 1 → B1 で 2 になるか確かめる"
    weight: 1
requirements:
  - id: total_floors
    label: "停止階の列から、移動した階数の合計を出力する"
  - id: no_zero_floor
    label: "B1 と 1 の間を 1 階分として数える（存在しない 0 階を数えない）"
  - id: parse_floors
    label: "B3〜B1 と 1〜99（2 桁を含む）を正しく読み、同じ階が続くときは 0 階分とする"
rubric_hints:
  correctness: "hidden-trap-b1-to-1*（0 階が無い）、hidden-trap-same-floor、hidden-trap-two-digit が通れば合格"
  explanation: "B_k → 1 − k の写し方を、B1 → 1 の例で検算してから書き始められれば加点"
  time_management: "3 分で階の数値化（B_k → 1 − k）を決め、8 分でサンプル 2 件が通り、残りで B1 → 1 と同じ階の連続を試す"
  red_flags:
    - "B1 を -1 に写して、B1 から 1 への移動を 2 階分と数える"
    - "階の文字列の 1 文字目だけを数字にして、12 を 1 と読む"
    - "1 階から出発したとみなして、最初の停止階までの移動を余分に足す"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 文字列解析・整数演算 / 題材: 0 階の無いビルのエレベーターの移動階数）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

あるビルのエレベーターは、地下 3 階から 99 階まで動きます。このビルには 0 階が無く、地下 1 階のすぐ上が 1 階です。階は下から順に `B3`, `B2`, `B1`, `1`, `2`, …, `99` と書きます。

エレベーターは F_1 階から出発して、F_2 階、F_3 階、…、F_N 階の順に止まりました。上下に隣り合う 2 つの階の間を 1 回動くことを「1 階分の移動」と数えるとき、エレベーターが移動した階数の合計を求めてください。

たとえば `3` から `B2` へは、3 → 2 → 1 → B1 → B2 と動くので 4 階分の移動です。

## 制約

入力:

```
N
F_1
F_2
…
F_N
```

出力: 移動した階数の合計を整数で 1 行に出力してください。

- 1 ≤ N ≤ 100
- F_i は `B3`・`B2`・`B1` のどれか、または 1 以上 99 以下の整数（先頭に 0 は付かない）
- 隣り合う F_i と F_{i+1} が同じ階のこともある
- N は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4
1
5
B2
3
```

出力例 1:

```
14
```

1 → 5 が 4 階分、5 → B2 が 6 階分、B2 → 3 が 4 階分で、合計 14 です。

入力例 2:

```
1
12
```

出力例 2:

```
0
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「出発するのは 1 階ですか」→ いいえ、F_1 階からです（N = 1 なら移動は 0）。
  - 「同じ階が続いたら」→ 0 階分です。
  - 「B4 や 100 階はありますか」→ ありません（B3〜99）。
- 見たいこと: B1 → 1 の移動を例にとって、写し方を検算してから書くか。文字列の 1 文字目だけで判定して 2 桁の階を誤読しないか。
- ヒントの出し順:
  1. 「B1 から 1 へは何階分ですか。あなたの式ではいくつになりますか」
  2. 「0 階が無いことを、数に直すときにどう吸収できますか」
  3. 「12 や 99 のような 2 桁の階をどう読んでいますか」
- 類題について: 「0 階が無い」階の数え方は日常的な題材。特定の既存問題の文面・数値は使っていない。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 階を整数 level に直します。地上の k 階は k、地下 k 階（`Bk`）は 1 − k です（B1 → 0、B2 → −1、B3 → −2）。こうすると 0 階の抜けが詰められ、隣り合う停止階の `|level(F_i) − level(F_{i−1})|` の和が答えになります。時間 O(N)。

**素朴解が落ちる理由**: 計算量の罠はありません。落ちるのは次のような写し方と読み方の誤りです。

- `Bk` を −k にすると、地上と地下をまたぐたびに 1 階分多く数えます（hidden-trap-b1-to-1）。
- 1 文字目だけを数字として読むと、`12` を 1 階と誤ります（hidden-trap-two-digit）。
- 同じ階が続くとき、特別扱いして 1 を足すなどの誤り（hidden-trap-same-floor）。

**別解**: 地上と地下をまたぐかどうかで場合分けしてもよいです。両方が同じ側なら差、またぐなら「差 − 1」です。また、B3〜99 を下から並べた一覧を作り、一覧の中の位置の差を数える方法でも正しく数えられます（gen/brute.py はこの方法）。

**言語別の注意**:
- C: `scanf("%s")` で文字列として読み、`s[0] == 'B'` なら `atoi(s + 1)`、そうでなければ `atoi(s)`。
- Go / Rust / TypeScript / PHP: `strings.TrimPrefix` / `strip_prefix` / `slice(1)` / `substr` で B を外してから数に直す。
- Python: `int("B2")` は例外になるので、先に `s[0] == "B"` を見る。
