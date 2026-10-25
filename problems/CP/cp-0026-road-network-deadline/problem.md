---
id: cp-0026
slug: road-network-deadline
title: "道路網と配達の締め切り"
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
    text: "通る道路の本数が少ない経路が、いちばん早いとは限りませんか"
  - at_sec: 900
    text: "N = 10^5 のとき、毎回すべての拠点から最小を探すと何回になりますか"
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
    text: "N, M ≤ 10^5、重み 1〜10^6 の単一始点最短路なので、二分ヒープの Dijkstra で O((N+M) log N) ≈ 3×10^6 回。重みがあるので BFS は使えないと宣言する"
    weight: 3
  - id: tp2
    text: "ヒープを使わず毎回全拠点から未確定の最小を探す Dijkstra は O(N^2) = 10^10 回で TLE。Bellman-Ford の O(NM) も同じく無理だと比べる"
    weight: 2
  - id: tp3
    text: "ヒープには (距離, 拠点) を push し、取り出した距離が dist[拠点] より大きければ古い要素として捨てる（捨てないと同じ拠点の辺を何度も見直して遅くなる）"
    weight: 3
  - id: tp4
    text: "距離は最大 10^6 × (10^5 − 1) ≈ 10^11、T も最大 10^12 なので 64bit。拠点 N に届かなければ -1、拠点 1 自身も数える、T = 0、同じ 2 拠点を結ぶ複数の道路を確かめる"
    weight: 1
  - id: tp5
    text: "入力は 3×10^5 個の整数をまとめて読み、隣接リストを作る。TypeScript には標準のヒープが無いので配列で二分ヒープを書く。サンプル 3（本数の少ない経路が遅い）を手で追う"
    weight: 1
requirements:
  - id: correct_output
    label: "1 行目に最短時間が T 以下の拠点の数（拠点 1 を含む）、2 行目に拠点 N までの最短時間（届かなければ -1）を出力する"
  - id: weighted
    label: "道路の通過時間を考慮した最短時間を求める（通る本数の最小では WA）"
  - id: int64
    label: "最短時間と T が 2^31 を超えても正しく扱う"
  - id: within_limit
    label: "N = M = 10^5 の入力や、同じ拠点がヒープに何度も入る入力でも制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-bfs-weights（BFS）・hidden-trap-int64 / hidden-max-chain（64bit）・hidden-trap-unreachable（-1）が WA の主因。hidden-max-sparse / chain は O(N^2) の Dijkstra を、hidden-max-stale-hub は古い要素を捨てない実装を TLE にする"
  explanation: "BFS が使えない理由、ヒープの役割、古い要素を捨てる理由を説明でき、O((N+M) log N) と O(N^2) を比べられれば加点"
  time_management: "10 分以内に Dijkstra と 64bit の方針を宣言、TypeScript などヒープを自作する言語でも 30 分以内にサンプル 3 件が通る、残りで到達不能と T = 0 を試す"
  red_flags:
    - "重みを無視して BFS（通る道路の本数の最小）で求める"
    - "距離を int（32bit）で持ち、鎖状の道路網で溢れる"
    - "ヒープから取り出した古い要素を捨てず、同じ拠点の辺を何度も見直す（hidden-max-stale-hub で TLE）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: Dijkstra 法（二分ヒープ・遅延削除）/ 題材: 運送会社の拠点と道路網。締め切りまでに届く拠点数と最終拠点までの時間）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "naive.c は同梱していない。O(N^2) の Dijkstra を C で書くと N = 10^5 で 10^10 回の比較になり TLE になるはずだが、確認しているのは naive.py（O(N^2)）と naive.php（古い要素を捨てない）の 2 つ"
---

## 問題文

ある運送会社には拠点が N か所あり、拠点 1〜N は M 本の道路で結ばれています。道路 j は拠点 u_j と拠点 v_j を双方向に結び、通過するのに w_j 分かかります。

荷物はすべて拠点 1 から出発し、道路を通って各拠点へ運ばれます。ある拠点までの所要時間は、拠点 1 からその拠点までの経路のうち、通過時間の合計が最も小さいものの値とします。

所要時間が T 分以下の拠点（拠点 1 自身を含む）の数と、拠点 N までの所要時間を求めてください。拠点 N に荷物を運べない場合は、所要時間の代わりに -1 を出力してください。

## 制約

入力:

```
N M T
u_1 v_1 w_1
u_2 v_2 w_2
…
u_M v_M w_M
```

出力: 1 行目に所要時間が T 以下の拠点の数、2 行目に拠点 N までの所要時間（運べないなら -1）を出力する（最後に改行を付ける）。

- 2 ≤ N ≤ 10^5
- 0 ≤ M ≤ 10^5
- 1 ≤ u_j, v_j ≤ N、u_j ≠ v_j（同じ 2 拠点を結ぶ道路が複数あることもある）
- 1 ≤ w_j ≤ 10^6
- 0 ≤ T ≤ 10^12
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 6 10
1 2 4
1 3 1
3 2 2
2 4 5
3 4 9
4 5 3
```

出力例 1:

```
4
11
```

所要時間は拠点 1〜5 の順に 0, 3, 1, 8, 11 です（拠点 2 へは拠点 3 を経由する方が早い）。

入力例 2:

```
4 2 5
1 2 5
3 4 1
```

出力例 2:

```
2
-1
```

入力例 3:

```
3 3 100
1 3 100
1 2 1
2 3 1
```

出力例 3:

```
3
2
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「拠点 1 は数に含める？」→ 含める（所要時間 0）。
  - 「T ちょうどは？」→ 含める（T 以下）。
  - 「同じ 2 拠点の道路が複数あるときは？」→ どれを通ってもよい。隣接リストに全部入れれば自然に最小が選ばれる。
  - 「道路は一方通行？」→ 双方向。隣接リストには両向きに入れる。
- ヒントの出し順:
  1. 「重みがあるとき、BFS の『先に見つかった方が近い』は成り立ちますか」（入力例 3 が反例）
  2. 「まだ確定していない拠点の中で、いちばん近いものを速く取り出すには何を使いますか」（優先度付きキュー / 二分ヒープ）
  3. 「同じ拠点がヒープに何回も入ったとき、古い方を取り出したらどうしますか」（dist より大きければ捨てる）
- TypeScript・C を選んだ人はヒープの自作が必要。時間配分（30 分でサンプル）を見る。PHP は `SplMinHeap`（配列 [距離, 拠点] をそのまま比較できる）、Go は `container/heap`、Rust は `BinaryHeap` + `Reverse`。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 隣接リストを両向きに作り、`dist[1] = 0`、ほかは「未到達」として、(0, 1) をヒープに入れます。ヒープから (d, u) を取り出し、`d > dist[u]` なら古い要素なので捨てます。そうでなければ u の各辺 (v, w) について `d + w < dist[v]` なら更新して (d + w, v) を push します。ヒープが空になったら、`dist ≤ T` の拠点を数え、`dist[N]`（未到達なら -1）を出力します。時間 O((N + M) log N)、空間 O(N + M)。

**素朴解が落ちる理由**:
- 重みを無視した BFS は「本数が少ない経路」を選ぶので WA（入力例 3、hidden-trap-bfs-weights）。
- ヒープを使わず、毎回全拠点から未確定の最小を探す Dijkstra は O(N^2) = 10^10 回で TLE（hidden-max-sparse / hidden-max-chain）。
- 古い要素を捨てないと、同じ拠点が何度も取り出されるたびに辺を見直します。hidden-max-stale-hub では拠点 N が 5×10^4 回 push され、5×10^4 本の辺を毎回見て 2.5×10^9 回になり TLE。

**別解**: 取り出した拠点に「確定済み」の印を付け、印のある拠点は飛ばす書き方も同じです。ヒープの代わりに平衡二分木（C++ の set など）で decrease-key をする方法もありますが、LCI の 6 言語では遅延削除の方が簡単です。

**言語別の注意**:
- C: ヒープは `long long` の距離と `int` の拠点を持つ構造体配列で自作する（push と pop の上下の入れ替え）。push は拠点 1 の 1 回と、両向きにした各辺で高々 1 回ずつなので、配列は 2M + 1 要素で足りる。隣接リストは CSR（先頭位置の配列 + 辺の配列）にすると速い。
- TypeScript: 標準にヒープが無い。配列で二分ヒープを書く（距離は 10^11 程度で 2^53 未満なので `number` でよい）。`Array.prototype.sort` を毎回呼ぶと O(N^2 log N) で TLE。
- Go: `container/heap` のインターフェースを実装するか、自作のヒープ。距離は `int64`（Go の int は 64bit 環境なら 64bit だが明示する）。
- Rust: `BinaryHeap` は最大ヒープなので `Reverse((d, u))` を入れる。距離は `u64` / `i64`。
- PHP: `SplMinHeap` に `[距離, 拠点]` を入れる（配列は先頭要素から比べられる）。`SplPriorityQueue` は最大優先なので優先度を負にする。
- Python: `heapq` にタプル `(d, u)`。入力は `sys.stdin.buffer.read().split()` でまとめて読む。
