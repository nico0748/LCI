---
id: cp-0014
slug: next-departure
title: "次の発車時刻"
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
    text: "その日の最終便の後に着いた人は、どの便に乗りますか"
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
    text: "N, Q ≤ 100 なので、照会ごとに全便を見る O(NQ) = 10^4 回で十分。ソートや二分探索は必須ではないと宣言できる"
    weight: 3
  - id: tp2
    text: "時刻を文字列のまま比べず、HH×60+MM の「分」に直してから比べる。日付をまたぐ待ち時間は「始発 + 1440 − 照会時刻」になる"
    weight: 2
  - id: tp3
    text: "照会時刻以上（>= で比べる、ちょうどは乗れる）の便のうち最小を選び、無ければ全便の最小（翌日の始発）を選ぶ。時刻表は時刻順とは限らないので最小を取るかソートする"
    weight: 3
  - id: tp4
    text: "エッジケース: ちょうどの時刻・最終便の後・便が 1 本で待ち 1439 分・同じ時刻の便が複数・00:00 の照会"
    weight: 1
  - id: tp5
    text: "出力は時・分とも 2 桁に 0 埋め（printf の %02d、f\"{h:02d}\"、padStart(2, \"0\")）。サンプル以外に 23:59 と 00:00 の照会を試す"
    weight: 1
requirements:
  - id: first_bus
    label: "照会時刻以降（ちょうどを含む）に最初に発車する便の時刻と、待ち時間（分）を出力する"
  - id: next_day
    label: "その日の便がもう無ければ翌日の始発を選び、待ち時間を日付をまたいで数える"
  - id: unsorted
    label: "時刻表が時刻順に並んでいなくても正しく答える"
  - id: format
    label: "時刻を HH:MM（時・分とも 2 桁）で出力する"
rubric_hints:
  correctness: "hidden-trap-exact-time・hidden-trap-next-day・hidden-trap-zero-pad・hidden-trap-unsorted がすべて通れば合格"
  explanation: "分に直してから比べる理由と、翌日に回るときの +1440 を説明できれば加点"
  time_management: "3 分で入出力（ちょうどは乗れる・0 埋め・翌日）を確認、12 分でサンプル 2 件が通る、残りで 23:59・00:00・便 1 本を試す"
  red_flags:
    - "> で比べて、ちょうどの時刻に発車する便に乗せない"
    - "時刻表を入力順に見て、最初に見つかった「照会以降の便」を答える（時刻表が未ソート）"
    - "時刻を 0 埋めせずに 5:07 のように出力する"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 時刻の分換算・日付またぎ / 題材: 駅前のバス停の時刻表）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 時刻表から次の便を探す定番。複数の照会・日付をまたぐ待ち時間・未ソートの時刻表の組合せは独自"
---

## 問題文

駅前のバス停からは、毎日同じ時刻表で N 本のバスが発車します。i 本目の発車時刻は T_i で、`HH:MM` の形（24 時間制、時・分とも 2 桁）で与えられます。時刻表は発車時刻の順に並んでいるとは限りません。

Q 人の利用者が、それぞれ時刻 U_j にバス停に着きます。着いた時刻ちょうどに発車するバスには乗れます。各利用者について、最初に乗れるバスの発車時刻と、それまでの待ち時間（分）を答えてください。その日のうちに発車するバスがもう無い場合は、翌日の最初のバスに乗ります（待ち時間は日付をまたいで数えます）。

## 制約

入力:

```
N
T_1
…
T_N
Q
U_1
…
U_Q
```

出力: Q 行。j 行目に、利用者 j が乗るバスの発車時刻（`HH:MM`、時・分とも 2 桁に 0 埋め）と待ち時間（分）を空白区切りで出力する。

- 1 ≤ N ≤ 100、1 ≤ Q ≤ 100（整数）
- T_i, U_j は `00:00`〜`23:59` の時刻（時・分とも 2 桁）。同じ時刻の便が複数あってもよい
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3
08:15
07:50
12:00
3
07:30
08:00
09:01
```

出力例 1:

```
07:50 20
08:15 15
12:00 179
```

07:30 に着いた人は 07:50 の便まで 20 分、09:01 に着いた人は 12:00 の便まで 179 分待ちます。

入力例 2:

```
2
06:05
22:40
2
23:10
00:00
```

出力例 2:

```
06:05 415
06:05 365
```

23:10 の後に今日の便は無いので、翌日 06:05 の便に乗ります（50 分 + 6 時間 5 分 = 415 分）。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「24:00 は出ますか」→ 出ない（00:00〜23:59）。
  - 「着いた時刻ちょうどの便には乗れますか」→ 乗れる（待ち 0 分）。
  - 「同じ時刻の便が 2 本あったら？」→ どちらに乗っても同じ。発車時刻を 1 回出せばよい。
  - 「便が 1 本も無い日は？」→ 無い（N ≥ 1、毎日同じ時刻表）。
- 見るところ: 比較の等号、+1440、0 埋め、時刻表の並び順を確かめたか。
- ヒントの出し順:
  1. 「08:15 と 07:50 は何分離れていますか。比べやすい形に直すには？」
  2. 「今日の便がもう無いとき、翌日の始発までは何分ですか」
  3. 「7 時 5 分に発車する便は、出力では何と書きますか」

## 振り返り用解説（終了後のみ表示）

**想定解**: 各時刻を `HH×60 + MM` の分（0〜1439）に直します。照会 u ごとに、u 以上の便のうち最小の d を探し、あれば待ち時間 `d − u`。無ければ全便の最小 d0（翌日の始発）を選び、待ち時間 `d0 + 1440 − u`。発車時刻は `d // 60` と `d % 60` を 2 桁ずつで出力します。時間 O(NQ)（ソートして二分探索なら O((N+Q) log N)）。

**素朴解との比較**: 照会時刻から 1 分ずつ時計を進めて、発車時刻と一致するまで数える方法でも、1 照会あたり最大 1440 回 × 100 = 1.4×10^5 回で間に合います（gen/brute.py はこの方法）。この問題の難しさは速度ではなく、等号・日付またぎ・0 埋め・並び順の 4 つの取りこぼしです。

**よくある誤り**:
- `d > u` で比べる → ちょうどの便に乗せない（hidden-trap-exact-time）。
- 翌日に回るときに待ち時間を `d0 − u`（負）や `|d0 − u|` にする（hidden-trap-next-day）。
- 時刻表を入力順に見て最初に条件を満たした便を答える（hidden-trap-unsorted）。
- 0 埋めを忘れる（hidden-trap-zero-pad）。

**別解**: 1 日 1440 分の表 `next[m]`（m 分以降で最初の便）を、後ろ（1439 分）から埋めていくと、各照会は O(1) で答えられます（翌日分は `next[0] + 1440`）。N, Q が 10^5 になったらソート＋二分探索か、この表を使います。

**言語別の注意**:
- C: `scanf("%d:%d", &h, &m)` で読める。出力は `printf("%02d:%02d %d\n", d / 60, d % 60, wait)`。
- TypeScript: `const [h, m] = s.split(":").map(Number)`。出力は `String(h).padStart(2, "0")`。
- Python: `f"{d // 60:02d}:{d % 60:02d} {wait}"`。
- Go: `fmt.Sscanf(s, "%d:%d", &h, &m)` か `strings.Split`。`fmt.Fprintf(w, "%02d:%02d %d\n", ...)`。
- Rust: `format!("{:02}:{:02} {}", d / 60, d % 60, wait)`。
- PHP: `sprintf('%02d:%02d %d', ...)`。`(int)"08"` は 8（8 進数にはならない）。
