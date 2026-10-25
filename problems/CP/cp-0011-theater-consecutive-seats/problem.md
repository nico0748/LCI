---
id: cp-0011
slug: theater-consecutive-seats
title: "映画館の連続空席"
category: CP
tier: core
difficulty: L1
time_limit: 20
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "K = W のときや、空席が列の右端まで続くときも見つけられますか"
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
    text: "H, W ≤ 100 なので、左端の候補ごとに K 席を数え直す O(HWK) でも最大 10^6 回で間に合う。計算量より境界の正しさが主眼だと宣言する"
    weight: 3
  - id: tp2
    text: "素朴な全探索は左端 c の範囲を 1〜W−K+1 にする（W−K までにすると K = W の 1 通りを試さない）。カウント方式なら O(HW) で 1 回の走査"
    weight: 2
  - id: tp3
    text: "列ごとに「いま続いている空席の数」を数え、K に達した瞬間に左端 = c − K + 1 が決まる。列が変わったらカウントを 0 に戻す（全列を 1 本の文字列につなぐと列をまたいで数えてしまう）"
    weight: 3
  - id: tp4
    text: "提出前に K = 1・K = W・右端まで続く空席・全部予約済みで -1・1×1 を自作して試す"
    weight: 1
  - id: tp5
    text: "出力は 1 始まりの「列 番号」。0 始まりの添字のまま出さない。各列は 1 行の文字列としてまとめて読む"
    weight: 1
requirements:
  - id: first_position
    label: "前の列から、同じ列では左から探して最初に見つかる K 席の左端を「列 番号」（1 始まり）で出力する"
  - id: same_row_only
    label: "別の列にまたがる空席は連続とみなさない"
  - id: row_end_and_k_eq_w
    label: "右端まで続く空席や K = W のときも見落とさない"
  - id: none
    label: "どこにも座れないときは -1 を出力する"
rubric_hints:
  correctness: "hidden-trap-row-reset（列をまたぐと K 席になる）と hidden-trap-row-end（右端で K に達する）、hidden-trap-k-equals-w が通れば合格ライン"
  explanation: "カウントを列ごとに 0 に戻す理由と、K に達した時点の左端の式（c − K + 1）を説明できれば加点"
  time_management: "3 分で入出力の形（1 始まり・-1）を確認、10 分でサンプル 3 件が通る、残りで K = W・右端・列またぎを自作して試す"
  red_flags:
    - "全列を 1 本の文字列につなげて探し、列をまたいだ空席を連続と数える"
    - "# を見たときだけ長さを確かめ、右端で終わる空席の並びを見落とす"
    - "左端の候補を range(W − K) で回して K = W の 1 通りを試さない"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 2 次元配列の走査・連続数のカウント / 題材: 映画館の座席予約）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 1 次元の列で K 個続く空きを探す定番（座席・駐車スペースなど）。題材と「前の列から・左から」の探索順、-1 の扱いは独自"
---

## 問題文

映画館の座席が前から 1 列目〜H 列目まであり、各列には左から 1 番〜W 番の W 席が横一列に並んでいます。r 列目の座席の状態は文字列 S_r で表され、その c 文字目が `.` なら c 番の席は空席、`#` なら予約済みです。

K 人のグループが、同じ列で横に K 席続けて空いているところに並んで座りたいと考えています。前の列から順に、同じ列の中では左から探したとき、最初に見つかる座り方を答えてください。つまり、K 席がすべて空席になる「列 r と左端の番号 c」の組のうち、r が最小のもの、その中で c が最小のものを出力します。どの列にも座れない場合は `-1` を出力してください。

## 制約

入力:

```
H W K
S_1
S_2
…
S_H
```

出力: 座れる場合は `r c`（r 列目の c 番から c+K−1 番までの K 席）を 1 行。座れない場合は `-1`。

- 1 ≤ H ≤ 100、1 ≤ W ≤ 100、1 ≤ K ≤ W
- H, W, K は整数。S_r は `.` と `#` だけからなる長さ W の文字列
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 6 3
..#..#
#...##
......
```

出力例 1:

```
2 2
```

1 列目は空席が 2 席までしか続きません。2 列目の 2〜4 番が最初に見つかる 3 席です（3 列目にも 3 席の空きがありますが、前の列が優先です）。

入力例 2:

```
2 5 2
#.#..
.....
```

出力例 2:

```
1 4
```

1 列目の 4〜5 番は右端まで空いているので、K = 2 の 2 人が座れます。

入力例 3:

```
3 4 3
.#..
#..#
..#.
```

出力例 3:

```
-1
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「K 席より長く空いていたら？」→ 座れる。その並びの左端から K 席を使う（例: 5 席空いていて K = 3 なら左端の番号を答える）。
  - 「列をまたいで座れますか」→ 座れない。同じ列で横に K 席。
  - 「通路はありますか」→ 無い。文字列で隣り合う席が隣の席。
  - 「出力の番号は 0 始まり？」→ 1 始まり（1 列目・1 番から数える）。
- 見るところ: 2 重ループの範囲（右端・K = W）、カウントを 0 に戻す場所（`#` と列の変わり目の両方）、出力の 1 始まり。
- ヒントの出し順:
  1. 「1 列だけなら、K 席の空きをどうやって見つけますか」
  2. 「`.` が続いた数を数えるとして、`#` を見たときと、列が変わったときに何をしますか」
  3. 「K 席目に達した瞬間、左端の番号はいくつですか（いま見ている番号との関係）」
- 全列を 1 本の文字列にして探し始めたら止めずに見守り、サンプル 3 の後で「1 列目の右端と 2 列目の左端が両方空いていたら？」と聞く。

## 振り返り用解説（終了後のみ表示）

**想定解**: 列ごとに左から見て、空席が続いた数 `run` を数えます（`.` なら +1、`#` なら 0 に戻す）。`run` が K に達したら、いま見ている c 番（1 始まり）から左端 `c − K + 1` が決まるので、`r c−K+1` を出力して終了します。列が変わるたびに `run` を 0 に戻します。最後まで見つからなければ `-1`。時間 O(HW)、最大 10^4 マス。

**素朴解との比較**: 左端の候補 (r, c) をすべて試して K 席を毎回数え直す O(HWK) でも、H = W = 100 なら最大 10^6 回で、どの言語でも間に合います。計算量より、c の範囲（1〜W−K+1。`W − K` までにすると K = W のとき 1 回も試さない）を正しく書けるかが分かれ目です。

**よくある誤り**:
- 全列を 1 本の文字列につなげて探す → 1 列目の右端と 2 列目の左端の空席を連続と数える（hidden-trap-row-reset）。
- `#` を見たときだけ「ここまでの長さが K 以上か」を確かめる → 右端で終わる並びを見落とす（hidden-trap-row-end）。ループの後にもう一度確かめるか、`.` を数えるたびに比べる。
- 0 始まりの添字のまま出力する。

**別解**: 各列で `"." * K`（K 個の `.`）を部分文字列として探すと、最初の一致位置がそのまま左端です。Python の `S.find("." * K)`、TS の `S.indexOf(".".repeat(K))`、PHP の `strpos`、C の `strstr`。列ごとに探すので列またぎも起きません。

**言語別の注意**:
- C: 各列は空白を含まないので `scanf("%s", row)` で読めます（配列は W + 1 文字以上）。
- TypeScript: `input.split("\n")` で行に分ける。`\r\n` の入力に備えるなら `trimEnd()`（今回のテストは LF のみ）。
- Python: `input()` を H 回呼んでもよいが、`sys.stdin.read().split()` でまとめて読むほうが速くて簡単。
- PHP: `strpos` は見つからないと `false` を返す。`0`（先頭で一致）と区別するため `=== false` で比べる。
