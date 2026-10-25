---
id: cp-0016
slug: charging-maze
title: "充電スタンド付きの迷路"
category: CP
tier: core
difficulty: L3
time_limit: 45
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "同じマスにもう一度来ることに意味はありますか"
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
    text: "H, W ≤ 60、B ≤ 60 なので状態 (マス, 電池の残り) は 60×60×61 ≈ 2.2×10^5、遷移はその 4 倍。状態付き BFS で O(HW(B+1)) と見積もる"
    weight: 3
  - id: tp2
    text: "マスだけで訪問済みにする普通の BFS は、先に残りの少ない状態で着くと、充電してきた残りの多い再訪を捨てて不正解になる（遠回りして充電しないと届かない地図で -1 や長い答え）"
    weight: 3
  - id: tp3
    text: "訪問済みを (マス, 残り) の組で持ち、移動先が C なら残りを B に、それ以外は 1 減らす。辺の重みはすべて 1 なので、G に最初に着いた手数が最短"
    weight: 2
  - id: tp4
    text: "エッジケース: 残り 0 でちょうど G に着く（可）・残り 0 の状態からは動けない・S では充電しない・壁で囲まれて -1・電池が足りず -1・S と G が隣"
    weight: 1
  - id: tp5
    text: "Python は状態を 1 次元の整数（(r·W+c)·(B+1)+残り）にして list と deque で回す。サンプル以外に「遠回りして充電する地図」を自作して試す"
    weight: 1
requirements:
  - id: shortest
    label: "電池の制約のもとで、G までの最小移動回数を出力する"
  - id: revisit
    label: "同じマスに残りの多い状態で再び来る経路（充電のための遠回り）を捨てない"
  - id: charge_rule
    label: "C に着いたら残りを B に戻し、残り 0 では動かない。残り 0 で G に着くのは可"
  - id: unreachable
    label: "着けない場合は -1 を出力する"
  - id: fast
    label: "60×60、B = 60 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-cell-only-*（マスだけの訪問管理）、hidden-trap-zero-at-goal、hidden-max-unreachable-explore-all が通れば合格"
  explanation: "状態に残りを入れる理由を、遠回りして充電する具体例で説明できれば加点。状態数 2.2×10^5 の見積もりまで言えれば満点"
  time_management: "10 分で状態の定義を宣言、25 分でサンプル 2 件が通る、残りで遠回りの地図・残り 0 での到着・到達不能を試す"
  red_flags:
    - "visited をマスだけで持つ BFS を書き、遠回りして充電する経路を捨てる"
    - "G に着いた時点で残り 1 以上を要求し、残り 0 での到着を不可にする"
    - "DFS で全経路を探して最小を取ろうとする（経路の数が指数的に増える）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 状態付き BFS（マス×電池の残り） / 題材: 倉庫の掃除ロボットと充電スタンド）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「残り燃料・残り体力つきの迷路」を状態拡張 BFS で解く定番。充電マスで満タンに戻る規則、S では充電しないこと、残り 0 での到着を可とすることを明記した"
---

## 問題文

倉庫の床が H 行 W 列のマスで表されています。`S` は掃除ロボットの出発地点、`G` は目的地、`#` は壁、`C` は充電スタンド、`.` は通路です。ロボットは 1 回の移動で上下左右の隣のマスに 1 マス動けますが、壁と床の外には入れません。

ロボットの電池は最大 B 回分で、出発時は満タン（残り B）です。1 マス動くたびに残りが 1 減り、残りが 0 のときは動けません。`C` のマスに着くと、その時点で残りが B に戻ります（何度でも使えます）。`S` のマスは通路と同じで、充電はできません。

ロボットが G に着くまでの最小の移動回数を答えてください。G に着いた時点で残りが 0 でもかまいません。G に着けない場合は `-1` を出力してください。

## 制約

入力:

```
H W B
S_1
S_2
…
S_H
```

出力: 最小の移動回数を 1 行。着けなければ `-1`。

- 1 ≤ H ≤ 60、1 ≤ W ≤ 60、1 ≤ B ≤ 60
- H, W, B は整数。S_i は `.` `#` `S` `G` `C` だけからなる長さ W の文字列
- `S` と `G` はちょうど 1 つずつある
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 6 5
S....#
###C.#
G.....
```

出力例 1:

```
8
```

S から 4 回動いて C（2 行目 4 列目）に着いた時点で残りは 1 ですが、充電されて 5 に戻ります。そこから 4 回で G に着くので 8 回です。充電しないと 5 回より先へは進めません。

入力例 2:

```
2 6 2
S..C..
#####G
```

出力例 2:

```
-1
```

C まで 3 回かかるので、電池 2 回分では C に着く前に止まってしまいます。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「充電に手数はかかりますか」→ かからない。着いた瞬間に残りが B になる。
  - 「C を通り過ぎるだけでも充電されますか」→ される（C のマスに着けば充電）。
  - 「S で充電できますか」→ できない（出発時は満タン）。
  - 「残り 1 で C に動いたら？」→ 着いた時点で残り 0 になるが、すぐに B に戻るので先へ進める。
  - 「G を通り抜けることは？」→ G に着いたら終わり。
- 見るところ: 状態の定義（マスだけでは足りない理由）を自分の言葉で言えるか。残り 0 の扱い、BFS の性質（最初に着いた手数が最短）。
- ヒントの出し順:
  1. 「同じマスに 2 回目に来たとき、1 回目より得をしていることはありますか」
  2. 「BFS の『状態』に何を足せば、その違いを区別できますか」
  3. 「状態は全部で何個ありますか。全部調べても間に合いますか」

## 振り返り用解説（終了後のみ表示）

**想定解**: 状態を (マス, 電池の残り) にした BFS です。`dist[マス][残り]` を -1 で初期化し、(S, B) を 0 としてキューに入れます。取り出した状態 (v, e) で e = 0 なら動けないので飛ばし、そうでなければ上下左右の隣 u（壁・盤の外を除く）について、u が G なら `dist + 1` が答え。そうでなければ残りを `u が C なら B、それ以外は e − 1` とし、その状態が未訪問なら距離を書いて積みます。各状態は 1 回しか積まれないので時間 O(HW(B+1)) ≈ 2.2×10^5 × 4。

**マスだけの BFS が落ちる理由**: BFS は手数の少ない順に状態を確定させますが、同じマスに「少ない手数・少ない残り」で先に着き、「多い手数・多い残り（途中で充電した）」で後から着くことがあります。マスだけで訪問済みにすると後者を捨ててしまい、その先の、残りが多くないと届かない場所へ行けなくなります（hidden-trap-cell-only-* は、この誤りで -1 や長い答えになる地図を gen で探して作ったもの）。

**よくある誤り**:
- G への移動にも「移動後の残り ≥ 1」を求める → 残り 0 で着く経路を落とす（hidden-trap-zero-at-goal）。
- 取り出した状態の残りが 0 でも隣へ動いてしまう。

**別解（支配による枝刈り）**: マスごとに「これまでに積んだ状態の残りの最大」`best[v]` を持ち、新しい状態の残りが `best[v]` 以下なら積まない。BFS は手数の少ない順なので、先に積まれた状態は手数が同じか少なく、残りも多いなら上位互換です。状態数が大きく減り、配列もマスの数だけで済みます。

**言語別の注意**:
- Python: 状態を 1 次元の整数にして `list` と `collections.deque`。`(r, c, e)` のタプルを `set` に入れても間に合うが 2〜3 倍遅い。
- TypeScript: `Int32Array` で dist、キューは `Int32Array` と先頭インデックス（`shift()` は O(n)）。
- C: `static int dist[60 * 60 * 61]` と、同じ大きさの配列をキューに（各状態は 1 回しか積まれない）。
- Go / Rust: スライス（Vec）をキューにして先頭インデックスで進めるか、Rust は `VecDeque`。
- PHP: `SplQueue` か、配列と先頭インデックス（`array_shift` は O(n) で遅い）。
