---
id: cp-0040
slug: nearest-shelter-bfs
title: "最寄りの避難所"
category: CP
tier: core
difficulty: L3
time_limit: 30
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [atcoder]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "避難所が 1 万個あったら、避難所ごとに BFS するやり方は間に合いますか"
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
    text: H, W ≤ 1000 なのでマスは最大 10^6 個。各マスを定数回だけ見る O(HW) が目標で、Python でも 10^6 マスの BFS 1 回なら間に合うと宣言する
    weight: 3
  - id: tp2
    text: 素朴解の「避難所ごとに BFS して最小を取る」は避難所の数 S に比例して O(S×HW)。S が 10^4 なら 10^10 回で TLE（マスごとに BFS しても同じ）
    weight: 2
  - id: tp3
    text: すべての避難所を距離 0 として最初にキューへ入れる多始点 BFS にすると、各マスが最初に取り出された距離が「最も近い避難所までの歩数」になり、BFS 1 回で全マスが決まる
    weight: 3
  - id: tp4
    text: 避難所が 0 個（D=-1、U=道のマスの数）、壁で囲まれて避難所へ行けない道のマス、避難所しか無い盤面（D=0）、蛇行した 1 本道で距離が約 5×10^5 になる、を列挙する
    weight: 1
  - id: tp5
    text: 10^6 文字をまとめて読み、盤面を周りに壁を足した 1 次元配列にすると範囲チェックが要らず速い。入力例 1 の距離を手で書き込んで確かめる
    weight: 1
requirements:
  - id: correct_output
    label: 避難所へ行ける通れるマスの最短歩数の最大 D と、どの避難所にも行けない道のマスの数 U を出力する
  - id: special_cases
    label: 避難所が 1 つも無いときは D = -1 とし、壁で囲まれたマスを U に数える
  - id: within_limit
    label: H=W=1000、避難所が多数でも制限時間内に終わる（避難所ごとに BFS しない）
rubric_hints:
  correctness: "hidden-max-many-shelters（避難所ごとの BFS の TLE）、入力例 2・hidden-edge-no-shelter（D = -1）、hidden-trap-enclosed（U の数え方）が通れば合格"
  explanation: "多始点 BFS が「仮想の始点から全避難所へ長さ 0 の辺を張った BFS」と同じであることを説明できれば加点"
  time_management: "8 分で多始点 BFS を宣言し、20 分以内に入力例 1・2 が通る"
  red_flags:
    - "計算量を言わずに、避難所（またはマス）ごとに BFS を書き始める"
    - "再帰 DFS で距離を更新し、蛇行した 1 本道で再帰の深さが 5×10^5 になって落ちる（DFS では最短距離にもならない）"
    - "避難所が 0 個のときに D を 0 と出力する"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 多始点 BFS / 題材: 地図上の各地点から最寄りの避難所までの歩数）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: グリッドの多始点 BFS は定番。最遠の距離と到達不能なマスの数の 2 つを出力させ、避難所 0 個の扱いを決めている"
---

## 問題文

H 行 W 列のマス目で表された地図があります。各マスは、道 `.`、建物 `#`、避難所 `S` のどれかです。人は、上下左右に隣り合う通れるマス（道か避難所）へ 1 歩で移動できます。建物のマスには入れません。

道の各マスについて、そこから最も近い避難所までの最短の歩数を考えます。どこかの避難所へ行ける道のマスについての歩数の最大値 D と、どの避難所へも行けない道のマスの数 U を求めてください。

避難所のマスの歩数は 0 として D に含めます（避難所はあるが、避難所へ行ける道のマスが無い場合は D = 0）。避難所が 1 つも無い場合は D = -1 とします。

## 制約

入力:

```
H W
G_1
⋮
G_H
```

G_i は地図の i 行目を表す長さ W の文字列です。

出力: D と U を空白区切りで出力する（最後に改行を付ける）

- 1 ≤ H, W ≤ 1000
- G_i は `.`・`#`・`S` だけからなる長さ W の文字列
- H, W は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 5
S..#.
.#.#.
...#.
##..S
```

出力例 1:

```
3 0
```

入力例 2:

```
2 3
..#
#..
```

出力例 2:

```
-1 4
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「避難所を通り抜けて別の避難所へ行ってもいいですか」→ よい（避難所も通れるマス）。ただし最も近い避難所が答えなので、通り抜ける必要は無い。
  - 「斜めには動けますか」→ 動けない。上下左右だけ。
  - 「避難所が 0 個のとき U は」→ 道のマスすべての数（入力例 2 は 4）。
- 入力例 1: 5 列目の 3 行目・2 行目・1 行目は、右下の避難所から 1, 2, 3 歩。3 行 3 列のマスは左上の避難所から 4 歩、右下から 3 歩なので 3。最大は 3 で、行けないマスは無い。
- ヒントの出し順:
  1. 「避難所が 1 つだけなら、どう解きますか。それを避難所の数だけ繰り返すと何回になりますか」
  2. 「全部の避難所から同時に水が広がっていくとしたら、各マスに水が着く時刻は何を表しますか」
  3. 「BFS の最初のキューに、避難所を全部入れてしまったらどうなりますか」
- Python で書く場合: 10^6 マスの BFS は、2 次元のリストと deque でも間に合うが、1 次元配列にすると余裕ができる。

## 振り返り用解説（終了後のみ表示）

**想定解答（多始点 BFS）**: すべての避難所を距離 0 として最初にキューへ入れ、普通の BFS を行います。BFS は距離の小さい順にマスを取り出すので、各マスに最初に到達したときの距離が「最も近い避難所までの歩数」になります（仮想の始点から全避難所へ長さ 0 の辺を張った BFS と同じ）。D は到達したマスの距離の最大、U は到達しなかった道のマスの数です。避難所が 1 つも無ければ BFS をせずに `-1` と道のマスの数を出します。各マスを 1 回ずつ取り出し、隣を 4 つ見るので O(HW) です。

盤面の周りに 1 マスずつ建物を足して 1 次元の配列にすると、隣は `p−1, p+1, p−(W+2), p+(W+2)` で表せ、範囲チェックが要らなくなります。

**素朴解が落ちる理由**: 避難所ごとに BFS して各マスの最小を取る方法は O(S × HW) です。hidden-max-many-shelters は避難所が約 1 万個あり、10^10 回になって C でも間に合いません。道のマスごとに最寄りの避難所を BFS で探す方法も、最悪 O((HW)^2) です。再帰 DFS で距離を更新する方法は最短距離にならず、蛇行した 1 本道（hidden-max-snake）では再帰が約 5×10^5 段になって落ちます。

**別解**: 段ごとに「今の距離のマスの列」と「次の距離のマスの列」を持つ書き方でも同じです（距離の配列が要らず、D は段の数になる）。

**言語別の注意**:
- Python: `sys.stdin.buffer.read().split()` で読み、`bytearray` の 1 次元盤面と `list` のキュー（先頭の添字を進める）か段ごとの列で書く。`deque` と 2 次元リストでも、このコンテナの計測で最大ケース 1.6 秒程度（制限は 6 秒）。
- TypeScript: キューは `Int32Array(H*W)` と head/tail の添字で持つ（`Array.prototype.shift` は O(n) で遅い）。
- C: 1 行を `scanf("%s")` で読むなら、バッファは W + 1 文字以上取る。キューと距離は `int` の配列（10^6 個）を `malloc` する。
- Go / Rust: キューはスライス / `Vec` と添字。入力は `bufio.Reader` / `read_to_string` でまとめて読む。
- PHP: 文字列の 1 次元盤面に `$g[$p]` でアクセスでき、キューは配列と添字で持つ（`array_shift` は遅い）。
