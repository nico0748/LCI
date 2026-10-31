---
id: cp-0018
slug: parking-free-areas
title: "駐車場の空き区画のまとまり"
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
    text: "このまとまりが 50 万マスの 1 本道だったら、今の書き方は大丈夫ですか"
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
    text: "H, W ≤ 1000 なので最大 10^6 マス。各マスを 1 回ずつ訪れる O(HW) の塗りつぶしにする。Python でも 10^6 マスを数回なめる程度に抑える"
    weight: 3
  - id: tp2
    text: "再帰 DFS は蛇行した 1 本道（約 5×10^5 マス）や全部空きの盤面で深さが 10^5〜10^6 になり、Python の再帰上限・Node のコールスタック（約 1 万段）・C のスタック 8MB を超えて落ちる"
    weight: 3
  - id: tp3
    text: "未訪問の空きマスを見つけるたびにまとまりの数を 1 増やし、キュー（BFS）か明示的なスタックで塗りながら区画数を数える。訪問済みの印は積むときに付ける"
    weight: 2
  - id: tp4
    text: "エッジケース: 全部 # で 0 0・斜めだけで接するマスは別のまとまり・1 行や 1 列の盤面・全部空きで 1 つ 10^6 区画・市松模様で 50 万個"
    weight: 1
  - id: tp5
    text: "10^6 文字の入力はまとめて読む。盤の周りを # で 1 周囲んで 1 次元にすると範囲チェックが要らず速い。大きい蛇行の入力を自作して落ちないか試す"
    weight: 1
requirements:
  - id: count
    label: "上下左右でつながる空き区画のまとまりの数を出力する"
  - id: max_area
    label: "最大のまとまりの区画数を出力する（空き区画が無ければ 0 0）"
  - id: no_stack_overflow
    label: "深さ 10^5 を超える蛇行や全部空きの盤面でも落ちない（再帰の深さに依存しない）"
  - id: fast
    label: "1000×1000 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-max-serpentine と hidden-max-all-free で落ちない（再帰しない）こと、hidden-trap-diagonal と hidden-trap-all-wall が通れば合格"
  explanation: "再帰 DFS が落ちる理由（深さ = 塗る順につながった経路の長さ、スタックの上限）を数字で言えれば加点。訪問済みを積む時点で付ける理由も"
  time_management: "5 分で BFS か明示的なスタックと宣言、15 分でサンプル 2 件が通る、残りで蛇行・全部空きの大きい入力を自作して試す"
  red_flags:
    - "再帰 DFS で書き、蛇行した最大ケースで RecursionError やスタックオーバーフローになる"
    - "Python で sys.setrecursionlimit を上げて済ませる（全部空きの 10^6 マスでメモリが尽きて落ちる）"
    - "8 方向で隣を見て、斜めだけで接するまとまりを 1 つに数える"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 連結成分の BFS/明示的スタック / 題材: イベント用の臨時駐車スペース）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: グリッドの連結成分を数える定番（島の数など）。最大面積も同時に問い、蛇行・全部空き・市松の最大ケースで再帰と速度を突く"
    - "gen/recursive_dfs.py は罠の確認用の再帰版（selftest の --naive の対象外。TLE ではなく異常終了で落ちるため naive.* にしていない）。このコンテナ（Python 3.13）での実測: 既定の再帰上限では hidden-mid-spiral 以上で RecursionError。上限を 10^7 に上げると hidden-max-serpentine は通る（約 0.9 秒）が、hidden-max-all-free は ulimit -v 512MB の下でメモリが尽きて異常終了。TS の再帰版は深さ約 1 万で Maximum call stack size exceeded、C の再帰版は serpentine と all-free でセグフォ（スタック 8MB）"
---

## 問題文

駐車場の区画が H 行 W 列のマスで表されています。`.` は空いている区画、`#` は車が停まっているか柱がある区画です。上下左右に隣り合う空き区画どうしは行き来できるものとし、行き来できる空き区画をすべて集めたもの（それ以上広げられないもの）を「まとまり」と呼びます。斜めに接しているだけの区画は行き来できません。

イベント用の臨時駐車スペースを決めるため、空き区画のまとまりがいくつあるかと、最も大きいまとまりの区画数を求めてください。空き区画が 1 つも無い場合は `0 0` を出力します。

## 制約

入力:

```
H W
S_1
S_2
…
S_H
```

出力: まとまりの数と、最も大きいまとまりの区画数を空白区切りで 1 行。

- 1 ≤ H ≤ 1000、1 ≤ W ≤ 1000
- H, W は整数。S_i は `.` と `#` だけからなる長さ W の文字列
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 6
..#...
.##.#.
#..##.
#.#..#
```

出力例 1:

```
4 6
```

左上の 3 区画、右上から右端を下る 6 区画、3〜4 行目の 2〜3 列目の 3 区画、4 行目の 4〜5 列目の 2 区画の 4 つのまとまりがあり、最も大きいのは 6 区画です。

入力例 2:

```
2 3
###
###
```

出力例 2:

```
0 0
```

空き区画が無いので `0 0` です。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「斜めはつながりますか」→ つながらない（上下左右だけ）。
  - 「空き区画が無いときは？」→ `0 0`。
  - 「最大のまとまりが複数あったら？」→ 区画数だけを答えるので関係ない。
- 見るところ: 最大ケースで再帰の深さがどこまで行くかを自分から見積もれるか。訪問済みのタイミング、10^6 文字の読み方。
- ヒントの出し順:
  1. 「まだ数えていない空き区画を見つけたら、そこからつながる区画をすべて印付けするには？」
  2. 「再帰で書いた場合、1 本道が 50 万マスあったら呼び出しは何段になりますか」
  3. 「キュー（またはリスト）を自分で持てば、再帰を使わずに同じことができます」
- 再帰で書き始めたら止めずに見守り、サンプルが通った後に「1000×1000 で全部空きなら？」と聞く。

## 振り返り用解説（終了後のみ表示）

**想定解**: 左上から順に見て、未訪問の空き区画を見つけたら数を 1 増やし、そこから BFS（キュー）か明示的なスタックで上下左右の空き区画を塗りながら区画数を数え、最大を更新します。訪問済みの印は「積むとき」に付けると、同じマスが 2 回積まれません。各マスは 1 回しか積まれないので時間 O(HW)、最大 10^6 マス。

**再帰 DFS が落ちる理由**: 再帰の深さは「塗る順につながった経路の長さ」です。hidden-max-serpentine は偶数行が通路、奇数行は左右交互に端の 1 マスだけ開いた 1 本道（500,500 マス）で、左上から再帰すると約 50 万段になります。全部空きの盤面（hidden-max-all-free）でも DFS の木は深さ約 10^6 になります。
- Python: 既定の再帰上限は 1000。`sys.setrecursionlimit` を上げると 3.11 以降は蛇行が通ることもあるが、10^6 段ではフレームのメモリが判定のメモリ上限を超えて落ちる。
- Node（TypeScript）: スタックは約 1 万段で `Maximum call stack size exceeded`。
- C / Rust: スタック 8MB。1 段 32〜64 バイトとして 10〜25 万段で尽きる。

**別解**:
- Union-Find: 右と下の空き区画を併合し、根ごとに大きさを数える（gen/brute.py の方法）。
- 行ごとの連続した空き区画（ラン）を単位にして、上の行のランと重なるものを併合すると、Python で頂点数を減らせる。

**言語別の注意**:
- Python: 盤を `bytearray` にして周りを `#` で囲み、上下左右を `±1`・`±(W+2)` で見る。`g.find(b".", pos)` で次の未訪問マスへ飛ぶと速い（このコンテナで最大ケース約 0.25 秒）。スタックは `list` の `append`/`pop`。
- TypeScript: 盤は `Uint8Array`、スタックは `Int32Array` と添字。BFS なら配列の `shift()` は O(n) なので使わない。
- C: 10^6 要素のスタックは `static` 配列かヒープに取る（関数内のローカル配列 4MB はスタックを圧迫する）。
- Go: goroutine のスタックは伸びるので再帰でも落ちにくいが、明示的なスタックのほうが速くメモリも少ない。
- Rust: メインスレッドのスタックは 8MB。`Vec` をスタックに使う。
- PHP: 配列の `$st[] = ...` と `array_pop`。再帰は深さ 10^5 程度でメモリ不足や異常終了になりうる。
