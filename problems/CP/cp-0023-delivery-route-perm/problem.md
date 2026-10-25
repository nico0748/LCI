---
id: cp-0023
slug: delivery-route-perm
title: "配達ルートの最短巡回"
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
    text: "N = 8 のとき、訪問順は全部で何通りありますか。全部試せますか"
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
    text: "N ≤ 8 なので訪問順は 8! = 40320 通り。1 通りあたり 9 回の距離計算でも約 3.6×10^5 回で、全探索で十分と最初に宣言する"
    weight: 3
  - id: tp2
    text: "近い地点から回る貪欲は最適にならない反例があり、先行条件もあるので全順列を試す。N が 15〜20 なら O(2^N × N^2) の bit DP に切り替える、と比較する"
    weight: 2
  - id: tp3
    text: "条件 (a_j, b_j) は「順列の中で a_j が b_j より前」。b より先に訪れる地点の集合をビットで持ち、順列を組み立てながら破った時点で捨てる"
    weight: 3
  - id: tp4
    text: "N = 1（往復で距離の 2 倍）、全地点が同じ座標（答え 0）、条件が全順序で 1 通りしかない場合、営業所へ戻る距離の足し忘れを確かめる"
    weight: 1
  - id: tp5
    text: "答えは小数 10 桁（printf の %.10f）で出す。%g（有効数字 6 桁）や小数 2 桁では誤差 10^-6 を超える。入力例 2 の 4 + 4√2 を手で確かめる"
    weight: 1
requirements:
  - id: correct_output
    label: "条件を満たす訪問順のうち、営業所に戻るまでの総移動距離の最小値を、絶対誤差または相対誤差 10^-6 以内で出力する"
  - id: precedence
    label: "すべての条件 (a_j, b_j) について a_j を b_j より先に訪れる順だけを候補にする（直前である必要はない）"
  - id: precision
    label: "小数点以下を十分な桁数で出力する（有効数字 6 桁や小数 2 桁に丸めない）"
  - id: small_cases
    label: "N = 1、同じ座標の地点、条件が全順序になる入力でも正しい"
rubric_hints:
  correctness: "hidden-trap-precision-*（出力桁数）・hidden-trap-greedy-nearest（貪欲）・hidden-trap-zigzag-orders / total-order（先行条件）が通れば合格ライン。計算量の罠は無い"
  explanation: "8! = 40320 の見積もりと、条件を順列のどこで確かめるかを説明できれば加点。bit DP との比較（N がいくつまでなら順列で足りるか）に触れられるとよい"
  time_management: "7 分以内に順列全探索の方針と出力桁数を宣言、18 分以内にサンプル 3 件が通る、残りで N=1 と全順序の条件を試す"
  red_flags:
    - "近い地点から順に回る貪欲で済ませる（hidden-trap-greedy-nearest で WA）"
    - "答えを小数 2 桁や C の %g（有効数字 6 桁）で出力して誤差判定に落ちる"
    - "最後に営業所へ戻る距離を足し忘れる、または条件を「直前に訪れる」と読み違える"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 順列全探索＋先行条件の枝刈り / 題材: 営業所から出て戻る配達ルート。受け取り地点を先に回る条件付き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 小規模な巡回セールスマン問題の全探索（定番の技法）。先行条件（受け取りを先に）を加えて差別化した"
---

## 問題文

配達員が営業所（地点 0）を出発し、N か所の配達先（地点 1〜N）をすべて 1 回ずつ訪れてから営業所に戻ります。地点 i の座標は (x_i, y_i) で、2 地点の間はまっすぐ移動し、移動距離はユークリッド距離です。

配達先の中には、別の配達先で荷物を受け取ってからでないと届けられないものがあります。M 個の条件 (a_j, b_j) が与えられ、地点 a_j は地点 b_j より先に訪れなければなりません（直前である必要はありません）。

すべての条件を満たす訪問順のうち、総移動距離の最小値を求めてください。条件を満たす訪問順が少なくとも 1 つあることは保証されます。

## 制約

入力:

```
N M
x_0 y_0
x_1 y_1
…
x_N y_N
a_1 b_1
…
a_M b_M
```

出力: 総移動距離の最小値を 1 行に出力する（最後に改行を付ける）。正しい値との絶対誤差または相対誤差が 10^-6 以下なら正解です。

- 1 ≤ N ≤ 8
- 0 ≤ M ≤ N(N−1)/2
- −1000 ≤ x_i, y_i ≤ 1000（同じ座標の地点があることもある）
- 1 ≤ a_j, b_j ≤ N、a_j ≠ b_j、同じ条件は 2 回以上現れない
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 0
0 0
3 4
3 -4
6 0
```

出力例 1:

```
20.0000000000
```

入力例 2:

```
3 2
0 0
2 0
2 2
0 2
1 3
3 2
```

出力例 2:

```
9.6568542495
```

訪問順は 1 → 3 → 2 しかなく、2 + 2√2 + 2 + 2√2 です。

入力例 3:

```
1 0
5 5
6 6
```

出力例 3:

```
2.8284271247
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「条件の a_j は b_j の直前でないといけない？」→ いいえ。先なら間に何か所挟んでもよい。
  - 「移動の途中で別の配達先の上を通ったら、訪れたことになる？」→ ならない。訪問順は 1〜N の並べ方だけで決まる。
  - 「出力の桁数は？」→ 誤差 10^-6 以内なら何桁でもよいが、足りないと落ちる。10 桁出すのが安全。
  - 「同じ座標の地点は？」→ あり得る。距離 0 で移動するだけ。
- ヒントの出し順:
  1. 「N = 8 のとき訪問順は何通りですか。それを全部試すと何回の計算ですか」（40320 × 9）
  2. 「訪問順を 1 つずつ作る方法はありますか」（next_permutation / itertools.permutations / 使用済みフラグ付きの再帰）
  3. 「条件はいつ確かめると楽ですか」（順列を作りながら、b を置く時点で a が置かれているか。ビット集合で O(1)）
- 貪欲（近い所から）を言い出したら、hidden-trap-greedy-nearest のような反例を一緒に考えてもらう。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 地点 1〜N の並べ方をすべて列挙します。条件は `need[b] = (b より先に訪れるべき地点のビット集合)` として持ち、順列を前から見ながら「v を置く時点で need[v] がすべて訪問済みか」を確かめ、破ったらその順列を捨てます。残った順列について「営業所 → 1 番目 → … → N 番目 → 営業所」の距離を足し、最小値を取ります。時間 O(N! × N)（N = 8 で約 3.2×10^5 回）、空間 O(N^2)（距離表）。

**貪欲が落ちる理由**: 「いちばん近い未訪問の地点へ進む」は最適を保証しません（hidden-trap-greedy-nearest）。また条件があると、そもそも近い地点に進めないことがあります（hidden-trap-zigzag-orders）。

**別解**: bit DP。`dp[訪問済み集合][最後の地点]` = 最短距離とし、`need[v] ⊆ 集合` の v にだけ進めます。O(2^N × N^2) なので N ≤ 16 程度まで使えます。この問題の N ≤ 8 ではどちらでも十分です。

**言語別の注意**:
- 出力桁数: C/PHP は `printf("%.10f\n", ans)`、Go は `fmt.Printf("%.10f\n", ans)`、Rust は `println!("{:.10}", ans)`、TypeScript は `ans.toFixed(10)`、Python は `f"{ans:.10f}"`。C の `%g` は有効数字 6 桁なので、答えが 1000 を超えると誤差判定に落ちる（hidden-trap-precision-*）。
- C/Rust/Go/TypeScript/PHP には Python の `itertools.permutations` に当たるものが無い（C++ の `next_permutation` も C には無い）。使用済みフラグ付きの再帰で列挙する。再帰の深さは N+1 なので問題ない。
- 距離は `sqrt(dx*dx + dy*dy)`（C は `-lm` が必要だが runner は付けている）。dx, dy は高々 2000 なので 2 乗しても int に収まる。
- TypeScript: `Math.hypot` は少し遅いが 40320 × 9 回なら問題ない。
