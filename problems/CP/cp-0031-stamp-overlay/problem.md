---
id: cp-0031
slug: stamp-overlay
title: "スタンプの重ね押し"
category: CP
tier: core
difficulty: L1
time_limit: 20
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "スタンプがキャンバスの左や上にはみ出したとき、どう扱っていますか"
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
    text: H, W, N, h_i, w_i ≤ 50 なので全スタンプの全マスを塗っても 50×50×50 = 1.25×10^5 回。計算量は問題にならず、座標の扱いの正確さが勝負と宣言する
    weight: 3
  - id: tp2
    text: キャンバスを H×W の 2 次元配列で持ち、スタンプを入力順に塗る（後に押したものが上）。逆順に塗るなら「まだ空のマスだけ」に書く必要がある、と比較して選ぶ
    weight: 2
  - id: tp3
    text: 絵柄の (i, j) はキャンバスの (r_i−1+i, c_i−1+j)。0 ≤ y < H かつ 0 ≤ x < W のときだけ書き、絵柄の '.' は書かない（透過）
    weight: 3
  - id: tp4
    text: 負の座標・右下へのはみ出し・完全に外のスタンプ・全部 '.' の絵柄を列挙する。Python の canvas[-1] は最後の行を指してしまうので範囲チェックは必須
    weight: 1
  - id: tp5
    text: 出力は exact 比較なので各行 W 文字を改行区切りで出す。入力例 2（負の座標）を手で追って確かめ、完全に外へ押すケースも自作して試す
    weight: 1
requirements:
  - id: correct_canvas
    label: すべてのスタンプを押し終えたキャンバスを H 行 W 文字で正しく出力する
  - id: transparent_and_order
    label: 絵柄の '.' は下を残し、後に押したスタンプが先のものを上書きする
  - id: clipping
    label: 負の座標やキャンバスの右・下へのはみ出しを含め、キャンバス外の部分を描かず、実行時エラーも起こさない
rubric_hints:
  correctness: "hidden-trap-negative（負の座標）と hidden-trap-clip-right-bottom（右下へのはみ出し）が通れば合格ライン。transparent / order は規則の読み落としを見る"
  explanation: "座標変換（r_i−1+i）と範囲チェックを、書く前に言葉で説明できれば加点。逆順に塗る別解との比較ができればさらに加点"
  time_management: "5 分で入力の読み方（スタンプごとに 1 行＋h_i 行）を決め、12 分以内に入力例 1〜3 が通る"
  red_flags:
    - "範囲チェックを y < H・x < W の上側だけにして、負の座標で Python の負の添字（末尾の行）に書いてしまう"
    - "絵柄の '.' でもキャンバスを上書きしてしまい、下のスタンプを消す"
    - "C で y*W+x の 1 次元配列に書き、x ≥ W のはみ出しが隣の行に回り込む"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 2 次元配列への描画とクリッピング / 題材: スタンプの重ね押し）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

H 行 W 列のキャンバスに、N 個のスタンプを順番に押します。最初、キャンバスのマスはすべて `.`（何も描かれていない）です。

i 番目のスタンプの絵柄は h_i 行 w_i 列で、絵柄の左上のマスがキャンバスの上から r_i 行目・左から c_i 列目（1 始まり）に重なるように押します。r_i や c_i は 0 以下のことも、キャンバスより大きいこともあります。キャンバスからはみ出した部分は何も描かれません。

絵柄の `.` のマスは透明で、下のキャンバスはそのまま残ります。それ以外の文字のマスは、重なったキャンバスのマスをその文字で上書きします。後に押したスタンプほど上に重なります。

すべてのスタンプを押し終えたキャンバスを出力してください。

## 制約

入力:

```
H W N
h_1 w_1 r_1 c_1
P_{1,1}
⋮
P_{1,h_1}
h_2 w_2 r_2 c_2
⋮
```

i 番目のスタンプは、1 行の `h_i w_i r_i c_i` と、絵柄を表す h_i 行の文字列 P_{i,1}, …, P_{i,h_i}（各 w_i 文字）からなります。

出力: キャンバスを H 行で出力する（各行 W 文字、最後に改行を付ける）。判定は行ごとの完全一致です（行末の空白だけは無視）。

- 1 ≤ H, W ≤ 50
- 1 ≤ N ≤ 50
- 1 ≤ h_i, w_i ≤ 50
- −100 ≤ r_i, c_i ≤ 100
- P_{i,j} は英大文字・`#`・`.` だけからなる長さ w_i の文字列
- P_{i,j} 以外の入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 6 2
3 3 1 1
###
#.#
###
2 4 2 2
XX.X
.XX.
```

出力例 1:

```
###...
#XX.X.
##XX..
......
```

入力例 2:

```
3 3 2
2 2 0 0
AB
CD
3 2 2 3
EF
GH
IJ
```

出力例 2:

```
D..
..E
..G
```

入力例 3:

```
2 3 1
1 2 3 4
ZZ
```

出力例 3:

```
...
...
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「r_i が 0 以下のとき、絵柄のどこが見えますか」→ キャンバスに重なる部分だけ。入力例 2 の 1 個目は右下の D だけが残る。
  - 「スタンプが完全にキャンバスの外のことはありますか」→ あります（入力例 3）。そのときは何も変わらない。
  - 「絵柄の行に空白は入りますか」→ 入らない。英大文字・`#`・`.` だけ。
- 見たいこと: 書き始める前に「絵柄の (i, j) → キャンバスの (r−1+i, c−1+j)」という変換と、その範囲チェックを口にするか。
- ヒントの出し順:
  1. 「絵柄の 1 マスが、キャンバスのどのマスに落ちるかを式で書いてみてください」
  2. 「その式の結果が 0 未満になったとき、あなたの言語の配列は何をしますか」（Python は末尾から数える、C は範囲外に書く）
  3. 「`.` のマスで書き込みを飛ばしていますか。入力例 1 の 2 行目で確かめてみましょう」
- 計算量は問わない（最大でも 1.25×10^5 マス）。TLE は狙っていない。

## 振り返り用解説（終了後のみ表示）

**想定解答**: キャンバスを H×W の 2 次元配列（すべて `.`）で用意し、スタンプを入力順に処理します。絵柄の i 行 j 列（0 始まり）は、キャンバスの y = r − 1 + i 行、x = c − 1 + j 列に落ちます。`0 ≤ y < H`、`0 ≤ x < W`、かつ絵柄の文字が `.` でないときだけ書き込みます。後に押したスタンプが上になるので、入力順に上書きすれば自然に正しくなります。全体で O(Σ h_i w_i) ≤ 1.25×10^5 回です。

**素朴解が落ちる理由**: 計算量の罠はありません。落ちる原因は座標の扱いです。範囲チェックを上側（y < H）だけにすると、負の座標で Python は `canvas[-1]`（最後の行）に、C は配列の外に書いてしまいます。C や Go でキャンバスを 1 次元配列 `y*W+x` で持つと、x ≥ W のはみ出しが次の行の先頭に回り込みます。

**別解**: スタンプを逆順（最後に押したものから）に処理し、「まだ `.` のマスにだけ書く」方法でも同じ結果になります。キャンバスの各マスについて、最後のスタンプから順に「そのマスを不透明な文字で覆うもの」を探す方法も正しいですが、O(HW × Σ) なのでこの制約でだけ使えます。

**言語別の注意**:
- Python: 負の添字は例外にならず末尾を指すので、`if 0 <= y < H` を必ず書く。出力は `"\n".join` でまとめる。
- C: 範囲外の書き込みはエラーにならずに他の変数を壊すことがある。絵柄の行は `char row[64]` などに `scanf("%s")` で読める（空白を含まない）。
- TypeScript: `arr[-1] = "A"` はエラーにならず `-1` というプロパティができるだけ。表示には出ないが、範囲チェックを省くと右側のはみ出しで配列が伸びて行の長さが変わる。
- Go / Rust: 範囲外の添字は panic になる。座標は負になりうるので、`usize` に変換する前に int（i64）のまま比較する。
- PHP: 文字列の添字 `$s[$x]` に範囲外を代入すると空白で埋めて伸びるので、範囲チェックしてから書く。
