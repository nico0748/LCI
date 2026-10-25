---
id: cp-0002
slug: warehouse-robot-commands
title: "倉庫ロボットの命令列"
category: CP
tier: core
difficulty: L2
time_limit: 30
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 600
    text: "L を何回も続けたとき、向きを表す値はどうなりますか"
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
    text: "命令は N ≤ 10^5 個、盤面は H×W ≤ 10^4 マスなので、命令 1 つを O(1) で処理すれば全体 O(HW + N) で十分と見積もる"
    weight: 3
  - id: tp2
    text: "訪れたマスを座標のリストに足して毎回 in で探す素朴な数え方は、リストが最大 10^4 件になり 10^5 × 10^4 = 10^9 回。H×W の真偽値配列（または集合）で O(1) にする"
    weight: 2
  - id: tp3
    text: "向きを 0=北 1=東 2=南 3=西 の添字で持ち、dr/dc の表を引く。R は (d + 1) % 4、L は (d + 3) % 4 にして負の剰余を作らない"
    weight: 3
  - id: tp4
    text: "エッジ: 1×1 の盤面、出発マスから一度も動けない（個数 1）、棚 # や盤面の外へ進む F は無視、同じマスの再訪を二重に数えない"
    weight: 1
  - id: tp5
    text: "盤面は H 行の文字列、命令は 1 行の文字列として読み、出力は「行 列」と個数の 2 行。L を 4 回続けて元の向きに戻る入力を自作して試す"
    weight: 1
requirements:
  - id: final_position
    label: "すべての命令を実行した後の位置を「行 列」（上・左から 1 始まり）で出力する"
  - id: visited_count
    label: "出発マスを含め、一度でもいたマスの個数を重複なく数えて出力する"
  - id: ignore_blocked
    label: "盤面の外や棚（#）へ進む F は無視し、その場にとどまる（向きも変えない）"
  - id: rotation
    label: "L / R が何回続いても向きが正しい（負の剰余で壊れない）"
rubric_hints:
  correctness: "hidden-trap-left-turns（L の連続）、hidden-trap-start-counted と hidden-trap-revisit（個数の数え方）、hidden-trap-wall-bump と hidden-trap-boundary（進めない F）が通れば合格"
  explanation: "向きの表現（添字と dr/dc の表）と、L を負の数にしない理由を説明できれば加点。行と列のどちらが北向きで減るかを最初に確認できればさらに加点"
  time_management: "5 分で向きの表現と進めない F の扱いを決め、15 分でサンプル 2 件が通り、残りで 1×1 と L の連続を試す"
  red_flags:
    - "L を (d - 1) % 4 と書き、C/Go/Rust/TS で向きの添字が -1 になる"
    - "訪れたマスの数を F が成功した回数で数える（再訪を二重に数える、出発マスを数えない）"
    - "行と列（r, c）と x / y の対応を途中で取り違え、北に進むと列が変わる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: グリッドシミュレーション・向きベクトル / 題材: 倉庫の棚の間を進む搬送ロボット）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

倉庫の床は H 行 W 列のマス目で、各マスは通路 `.` か棚 `#` です。搬送ロボットは `S` のマス（通路）から北（上）を向いて出発し、長さ N の命令列 C を先頭から 1 文字ずつ実行します。

- `F`: 向いている方向に 1 マス進む。進む先が盤面の外か棚のときは、その命令を無視してその場にとどまる。
- `L`: その場で左に 90 度向きを変える。
- `R`: その場で右に 90 度向きを変える。

すべての命令を実行した後のロボットの位置と、ロボットが一度でもいたことのあるマスの個数（出発したマスを含む）を求めてください。

## 制約

入力:

```
H W
S_1
S_2
…
S_H
N
C
```

出力: 1 行目に最後の位置を `r c`（上から r 行目、左から c 列目。どちらも 1 始まり）、2 行目に一度でもいたマスの個数を出力してください。

- 1 ≤ H ≤ 100、1 ≤ W ≤ 100
- S_i は `.`・`#`・`S` からなる長さ W の文字列で、`S` は盤面全体にちょうど 1 個ある
- 1 ≤ N ≤ 10^5
- C は `F`・`L`・`R` からなる長さ N の文字列
- H, W, N は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 4
....
.#..
S...
9
FFRFFRFLF
```

出力例 1:

```
2 4
7
```

北へ 2 マス進んで 1 行 1 列目、右を向いて東へ 2 マス進んで 1 行 3 列目、右を向いて南へ 1 マス、左を向いて東へ 1 マス進み、2 行 4 列目で終わります。いたことのあるマスは 7 個です。

入力例 2:

```
2 3
S.#
...
9
RFFFRFLLF
```

出力例 2:

```
1 2
3
```

東へ 1 マス進んだ後の 2 回の `F` は、棚にぶつかるので無視されます。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「出発したマスも数えますか」→ 数えます。一度も動けなければ答えは 1 です。
  - 「棚にぶつかったら向きは変わりますか」→ 変わりません。その `F` を無視するだけです。
  - 「同じマスに何度来ても 1 個ですか」→ はい、重複なく数えます。
  - 「北に進むと行番号は増えますか」→ 減ります（1 行目が一番上）。
- 見たいこと: 向きの表現を先に決めるか。L を `(d - 1) % 4` と書いた場合に、使っている言語で負になると気づくか。
- ヒントの出し順:
  1. 「向きを 0〜3 の数で持つと、L と R はどう書けますか」
  2. 「北向きで L を押すと、その式は何になりますか。C や TypeScript の `%` で負の数を割るとどうなりますか」
  3. 「1 マスの盤面と、出発してすぐ棚にぶつかる入力を作ってみましょう」
- 類題について: 命令列でロボットを動かすシミュレーションは一般的な題材。棚・出発マスの数え方などの組み合わせは独自。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 向き d を 0=北, 1=東, 2=南, 3=西 とし、`dr = [-1, 0, 1, 0]`、`dc = [0, 1, 0, -1]` の表を使います。`R` で `d = (d + 1) % 4`、`L` で `d = (d + 3) % 4` です。`F` では進む先 (r + dr[d], c + dc[d]) が盤面の中かつ `#` でないときだけ移動します。訪れたかどうかを H×W の真偽値配列で持ち、初めて来たマスで個数を 1 増やします（出発マスは最初に印を付けて 1 から数え始める）。時間 O(HW + N)、空間 O(HW)。

**素朴解が落ちる理由**:
- `(d - 1) % 4` は C / Go / Rust（`i32` の `%`）/ TypeScript / PHP では d = 0 のとき -1 になり、配列の範囲外を読みます（hidden-trap-left-turns）。
- 「F が成功した回数 + 1」を個数にすると、再訪を重ねて数えてしまいます（hidden-trap-revisit）。
- 訪れたマスを座標のリストに入れて線形に探すと、hidden-max-open（約 9000 マスを訪れ、F が約 7 万回）で 10^8 回以上の比較になります。Python では間に合わない恐れがあります。

**別解**: 訪問済みを座標の集合（set / HashSet / map）で持っても O(1) です。向きを (dr, dc) の組で持ち、右回転を (dr, dc) → (dc, −dr)、左回転を (dr, dc) → (−dc, dr) と書くと、剰余を使わずに済みます。

**言語別の注意**:
- C / Go / TypeScript / PHP: `%` は割られる数の符号を引き継ぐので、`(d - 1) % 4` は -1 になりうる。`(d + 3) % 4` か `((d - 1) % 4 + 4) % 4` にする。Rust は `rem_euclid` も使える。
- Rust: 座標を `usize` で持つと `r - 1` が 0 で桁あふれする（release ビルドでは黙って巨大な値になる）。`i32` などで計算してから範囲を確かめる。
- Python: 1 行目の盤面を `list(row)` にして書き換える必要は無い。読むだけなら文字列のまま `grid[r][c]` で引ける。
- 入力の行末に `\r` が付いた環境に備え、行で読むなら strip する（トークン区切りで読めば気にしなくてよい）。
