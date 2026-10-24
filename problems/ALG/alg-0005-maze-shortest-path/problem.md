---
id: alg-0005
slug: maze-shortest-path
title: 迷路の最短手数（BFS）
category: ALG
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: main.py
    language: python
    content_ref: starter/python/main.py
  - path: main.ts
    language: typescript
    content_ref: starter/typescript/main.ts
talking_points:
  - id: tp1
    text: 重みのないグリッドの最短手数は BFS で求まり、DFS は最初に見つけた道が最短とは限らない
    weight: 3
  - id: tp2
    text: 訪問済みの印はキューに入れる時点で付ける（取り出す時点だと同じマスが何度もキューに入る）
    weight: 2
  - id: tp3
    text: 各マスを高々 1 回処理するので O(HW)。H=W=500 で 25 万マス
    weight: 2
  - id: tp4
    text: 再帰 DFS は Python の再帰上限や JS のスタック上限に当たるので、キューを使う反復で書く
    weight: 1
  - id: tp5
    text: 到達できないときに -1 を返すこと、グリッドの外に出ない境界チェックをテストで確かめる
    weight: 1
requirements:
  - id: shortest
    label: S から G への最短手数を答える
  - id: unreachable
    label: 到達できないときは -1 を答える
  - id: walls
    label: 壁とグリッドの外には進まない
  - id: fast
    label: 500×500 のグリッドでも制限時間内に答える
rubric_hints:
  correctness: "全ケース AC で合格。DFS で書いた場合は「DFS トラップ」ケースで WA になる"
  explanation: "BFS が最短を保証する理由（手数の小さい順にマスが確定する）を説明できるか。訪問済みを付けるタイミングに触れれば加点"
  time_management: "5 分で BFS と決め、15 分で動くコード、残りで到達不能と境界のテスト"
  red_flags:
    - "DFS で見つけた最初の経路の長さを答える"
    - "取り出し時に訪問済みを付けて、大きいケースで時間やメモリが膨らむ"
    - "Python の list.pop(0) をキューに使って O(N^2) になる"
  checklist: []
reference_solutions:
  python: solutions/python/main.py
  typescript: solutions/typescript/main.ts
source:
  origin: "LCI オリジナル（倉庫内の搬送ロボットの経路を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

倉庫の床を H 行 W 列のマスで表した地図があります。搬送ロボットはスタート `S` から上下左右に 1 マスずつ動き、壁 `#` には入れず、地図の外にも出られません。ゴール `G` まで最短で何手かかるかを答えてください。たどり着けない場合は `-1` を出力します。

## 制約

入力:

```
H W
（H 行の文字列。各行は W 文字で、`.` `#` `S` `G` のいずれか）
```

出力: 最短手数を 1 行。到達できなければ `-1`。

- 1 ≤ H, W ≤ 500
- `S` と `G` はちょうど 1 つずつあり、別のマス
- 制限時間 2 秒（Python は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します
- 設問者への質問は OK。Web 検索は不可。

入力例:

```
4 5
S..#.
.#...
.#.#.
...#G
```

出力例: `7`

## 面接官メモ（非公開）

- BFS の定番。書けるかどうかより、「なぜ BFS なのか」「訪問済みをいつ付けるか」を言語化できるかを見る。
- 想定質問と答え:
  - 「斜めは？」→ 動けない（上下左右のみ）。
  - 「S と G は必ずある？」→ ちょうど 1 つずつ。
  - 「G に着いたら打ち切っていい？」→ よい。
- ヒントの出し順: (1) 「1 手で行けるマス、2 手で行けるマス…と広げていくと？」 (2) 「同じマスに 2 回目に来たとき、何か得をしますか」
- DFS で書き始めた場合は止めずに見守り、テストで最短でない答えが出たら原因を説明させる。

## 振り返り用解説（終了後のみ表示）

**想定解答**: S から BFS。距離配列を -1 で初期化し、S を 0 にしてキューへ。取り出したマスの上下左右のうち、地図内・壁でない・未訪問のマスに「距離 + 1」を書いてキューに入れる。G の距離が答え（未訪問なら -1）。各マスは 1 回しかキューに入らないので O(HW)。

キューは Python なら `collections.deque`、TypeScript なら配列と先頭インデックス（`shift()` は O(n) なので避ける）。2 次元座標は `r * W + c` の 1 次元インデックスにすると速く書ける。

**DFS が駄目な理由**: DFS は 1 本の道を行き止まりまで進むので、最初に G に着いた道が遠回りになりうる。全経路を探索して最小を取れば正しいが、指数時間になる。

**別解 A: 両側 BFS**。S と G の両方から BFS を広げ、出会ったところで止める。最悪計算量は同じだが、実際に調べるマスが減ることが多い。

**別解 B: 重みがある場合**。マスごとに進むコストが違うなら Dijkstra、コストが 0 か 1 の 2 種類なら 0-1 BFS（両端キュー）に一般化できる。
