---
id: cp-0012
slug: moss-spread
title: "苔の広がり"
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
  - at_sec: 300
    text: "同じ日のうちに変わったマスが、隣のマスの判定に影響していませんか"
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
    text: "H, W ≤ 50、T ≤ 100 なので、毎日全マスを見直す O(T·H·W) = 25 万マス × 隣 4 つで十分間に合う。工夫が要るのは計算量ではなく更新の順序だと宣言する"
    weight: 3
  - id: tp2
    text: "盤面を 1 枚だけ持ってその場で書き換えると、同じ日に苔になったマスが右や下のマスの判定に効いてしまう。前の日の盤面と新しい盤面の 2 枚（二重バッファ）を使う"
    weight: 3
  - id: tp3
    text: "規則は「上下左右の苔の数 m」だけで決まる: `.` は m ≥ 2 で苔、`o` は m = 0 か m = 4 で石、`#` は不変。m を数える処理を 1 か所にまとめる"
    weight: 2
  - id: tp4
    text: "端のマスは隣が 2〜3 マスしか無い。Python の g[r-1] は r = 0 で最後の行を指すので範囲を必ず確かめる。T = 0・1×1・全部苔も試す"
    weight: 1
  - id: tp5
    text: "新しい盤面は行ごとの深いコピーで作る（Python は [row[:] for row in g]、JS は g.map(r => r.slice())）。g[:] だけだと中の行を共有する。出力は H 行をまとめて書く"
    weight: 1
requirements:
  - id: simultaneous
    label: "すべてのマスを、前の日の盤面だけから同時に更新する"
  - id: rules
    label: "3 つの規則（2 マス以上で苔になる・0 か 4 マスで石に戻る・岩は変わらない）を正しく適用する"
  - id: border
    label: "盤の外を苔として数えず、端のマスで添字が範囲外や反対側の端に回り込まない"
  - id: t_zero
    label: "T = 0 なら入力の盤面をそのまま出力する"
rubric_hints:
  correctness: "hidden-trap-inplace-*（その場更新）、hidden-trap-edge-wrap（負の添字の回り込み）、hidden-trap-edge-border が通れば合格ライン"
  explanation: "二重バッファが必要な理由を、同じ日に苔になったマスが隣の判定に効く具体例（サンプル 1 の 2 行目）で説明できれば加点"
  time_management: "5 分で規則と「同時に変わる」ことを確認、15 分でサンプル 3 件が通る、残りで端・T = 0・1×1 を試す"
  red_flags:
    - "盤面を 1 枚だけ持ってその場で書き換える"
    - "Python で g[r-1][c] を範囲チェックせずに読み、r = 0 のとき最後の行を隣として数える"
    - "新しい盤面を g[:]（浅いコピー）で作り、結局同じ行を書き換えている"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: セルオートマトン・二重バッファ / 題材: 石畳の苔の観察）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: ライフゲーム型の盤面更新。規則（4 近傍・2 以上で発生・0 か 4 で消滅・岩）は独自で、Conway のライフゲーム（8 近傍・B3/S23）とは異なる"
---

## 問題文

石畳を H 行 W 列のマスに区切って、苔の広がり方を観察しています。各マスは `o`（苔が生えている）、`.`（苔の無い石）、`#`（岩）のいずれかです。

毎日、すべてのマスが**前の日の盤面だけを見て同時に**、次の規則で変わります。「隣」とは上下左右の 4 マスのうち盤の内側にあるもので、盤の外は苔として数えません。

1. `.` のマスは、隣の `o` が 2 マス以上なら `o` になる。
2. `o` のマスは、隣の `o` が 0 マス（乾く）か 4 マス（蒸れる）なら `.` になる。それ以外なら `o` のまま。
3. `#` のマスは変わらない。`#` は苔として数えない。

T 日後の盤面を出力してください。

## 制約

入力:

```
H W T
S_1
S_2
…
S_H
```

出力: T 日後の盤面を H 行（各行 W 文字、入力と同じ形）。

- 1 ≤ H ≤ 50、1 ≤ W ≤ 50、0 ≤ T ≤ 100
- H, W, T は整数。S_i は `o` `.` `#` だけからなる長さ W の文字列
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 4 1
.o..
oo.o
..#.
```

出力例 1:

```
oo..
ooo.
..#.
```

1 行目 1 列目と 2 行目 3 列目の石は隣の苔が 2 マスなので苔になり、2 行目 4 列目の苔は隣に苔が無いので石に戻ります。どれも前の日の盤面だけで決まります（2 行目 3 列目が苔になったことは、同じ日の 2 行目 4 列目の判定には影響しません）。

入力例 2:

```
4 5 3
.o...
ooo..
.o.#.
.....
```

出力例 2:

```
ooo..
o.o..
ooo#.
.....
```

入力例 3:

```
2 3 0
o.o
#o.
```

出力例 3:

```
o.o
#o.
```

T = 0 なので入力のままです。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「盤の外は苔として数えますか」→ 数えない。端のマスは隣が少ないだけ。
  - 「岩は苔の隣として数えますか」→ 数えない（岩は苔ではない）。
  - 「途中の日の盤面も出しますか」→ 出さない。T 日後だけ。
  - 「T = 0 は？」→ ある。入力の盤面をそのまま出す。
- 見るところ: 「同時に」をどう実装するか（二重バッファ）を自分から言えるか。端の処理とコピーの深さ。
- ヒントの出し順:
  1. 「サンプル 1 の 2 行目 3 列目が苔になったことは、同じ日の 2 行目 4 列目の判定に影響しますか」
  2. 「前の日の盤面を最後まで残しておくには、何を用意すればよいですか」
  3. 「隣の苔を数える関数を 1 つ書いて、盤の外は 0 として扱いましょう」
- その場更新で書き始めたら止めずに見守り、サンプル 1 が合わなかったところで原因を説明させる。

## 振り返り用解説（終了後のみ表示）

**想定解**: 毎日、新しい盤面 `nxt` を前の日の盤面 `g` のコピーとして用意し、各マス (r, c) について **g から**上下左右の苔の数 m を数えて、規則どおりに **nxt に**書きます（`.` は m ≥ 2 で `o`、`o` は m が 0 か 4 で `.`、`#` はそのまま）。全マスを書き終えたら `g = nxt`。これを T 回。時間 O(T·H·W)、最大 100 × 2500 = 2.5×10^5 マス。

**その場更新が落ちる理由**: 1 枚の盤面を左上から書き換えると、同じ日にすでに書き換えたマス（左や上）を、前の日の状態のつもりで読んでしまいます。サンプル 1 では 2 行目 3 列目が先に苔になり、2 行目 4 列目の苔が「隣に苔がある」と判定されて残ってしまいます。T が大きいほどずれは広がります（hidden-trap-inplace-*）。

**よくある誤り**:
- Python で `g[r - 1][c]` を範囲チェックなしで読む → r = 0 のとき `g[-1]` は最後の行（hidden-trap-edge-wrap）。`g[r][c + 1]` は c = W−1 で IndexError になるので気づきやすいが、負の添字は黙って通る。
- 盤の外を苔として数える → 端の苔が蒸れて消える（hidden-trap-edge-border）。
- `nxt = g[:]` → 行のリストだけがコピーされ、中の行は同じオブジェクト。

**別解**:
- 盤の周りを `#` で 1 周囲む（番兵）と範囲チェックが不要になり、添字の誤りも防げる。
- 盤面を 2 枚用意して交互に使う（毎日コピーを作らない）。
- 盤面が前に出た状態に戻ったら周期で T を縮められるが、T ≤ 100 では不要。

**言語別の注意**:
- Python: 負の添字の回り込みと浅いコピー。文字列は書き換えられないので `list` の `list` にする。
- TypeScript: `Array(h).fill([])` は同じ配列を共有する。`g.map((row) => row.slice())` でコピー。
- C: `char g[50][51], nxt[50][51]` を用意して `memcpy`。行末の NUL に注意して `printf("%s\n")`。
- Go: `[][]byte` は `copy` で行ごとにコピー（`nxt := g` は同じ配列を指す）。
- Rust: `Vec<Vec<u8>>` を `clone()`。添字は `usize` なので `r - 1` は r = 0 で panic（`r > 0 &&` を先に）。
- PHP: 配列は代入でコピーされる（`$nxt = $g;` で別物）。文字列の 1 文字は `$s[$c]` で読み書きできる。
