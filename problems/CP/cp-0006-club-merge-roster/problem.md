---
id: cp-0006
slug: club-merge-roster
title: "サークル合併の名簿"
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
    text: "合併のたびに名簿を書き換える方法は、この制約で間に合いますか"
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
    text: "N, Q ≤ 10^5 なので操作 1 回あたりほぼ O(1)（O(α(N))）が必要。合併のたびに O(N) かけると 10^10 回になると見積もる"
    weight: 3
  - id: tp2
    text: "素朴解: 所属番号の配列を持ち、合併のたびに片方の全員の番号を付け替える。鎖状の合併（1 1 2 / 1 2 3 / …）では毎回大きい組を動かし O(N^2) = 5×10^9 回"
    weight: 2
  - id: tp3
    text: "観察: Union-Find で各サークルを根付き木にし、根に人数 size を持たせる。小さい木を大きい木の根に付け（union by size）、find は経路圧縮か経路半減で浅く保つ"
    weight: 3
  - id: tp4
    text: "エッジ: 同じサークルどうしの合併（人数を足し直さない）、a = b、N = 1、深さ 10^5 の木で再帰の find が落ちる（Python の再帰上限 1000、Node のスタック）"
    weight: 1
  - id: tp5
    text: "操作ごとに語の数が違う（種類 2 は 2 語、1 と 3 は 3 語）ので種類を見てから読む。出力は溜めてまとめて書く。1 i i+1 を並べた鎖状の入力を自作して試す"
    weight: 1
requirements:
  - id: correct_answers
    label: "種類 2 には人数、種類 3 には Yes / No を、操作の順に 1 行ずつ出力する"
  - id: remerge
    label: "すでに同じサークルの 2 人を合併しても人数を変えない"
  - id: deep_chain
    label: "鎖状に 10^5 回合併しても落ちない（再帰の深さやスタックの溢れに耐える）"
  - id: within_limit
    label: "N = Q = 10^5 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-max-chain（付け替え方式の TLE）、hidden-trap-deep-chain* と hidden-max-chain*（深い木と再帰）、hidden-trap-remerge*（人数の二重加算）が通れば合格"
  explanation: "union by size と経路圧縮がそれぞれ何を防ぐのか（木の高さ / 同じ道のたどり直し）を説明でき、素朴な付け替えの O(N^2) と比べられれば加点"
  time_management: "5 分で Union-Find の方針（size 併合・経路圧縮）を宣言し、15 分でサンプル 2 件が通り、残りで同じ組の再合併と鎖状の合併を試す"
  red_flags:
    - "合併のたびに所属番号を全員分付け替える（hidden-max-chain で TLE）"
    - "find を再帰で書き、union by size もしないので、深さ 10^5 の木で RecursionError やスタック溢れになる"
    - "すでに同じ根なのに size[a] += size[b] を実行して人数が倍になる"
    - "合併で parent[a] = b のように、根ではなく元の学生どうしをつなぐ"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: Union-Find（経路圧縮・サイズ併合）/ 題材: 大学のサークルの合併と名簿の照会）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: Union-Find の定番（合併・同一判定・サイズ照会）そのもの。題材と 3 種類の操作の組み合わせは独自"
---

## 問題文

ある大学には学生が N 人いて、はじめは学生 i（1 ≤ i ≤ N）がそれぞれ 1 人だけのサークルに入っています。これから Q 個の操作を順に処理します。

- `1 a b`: 学生 a のいるサークルと学生 b のいるサークルを合併して、1 つのサークルにする。2 人がすでに同じサークルにいるなら何もしない。
- `2 a`: 学生 a のいるサークルの人数を出力する。
- `3 a b`: 学生 a と学生 b が同じサークルにいるなら `Yes`、そうでなければ `No` を出力する。

## 制約

入力:

```
N Q
query_1
query_2
…
query_Q
```

query_j は `1 a b`、`2 a`、`3 a b` のどれかの形です。

出力: 種類 2 と種類 3 の操作それぞれについて、答えを操作の順に 1 行ずつ出力してください。

- 1 ≤ N ≤ 10^5
- 1 ≤ Q ≤ 10^5
- 1 ≤ a ≤ N、1 ≤ b ≤ N（a = b のこともある）
- 種類 2 か種類 3 の操作が 1 つ以上ある
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 7
1 1 2
2 1
1 3 4
3 2 4
1 2 3
3 1 4
2 4
```

出力例 1:

```
2
No
Yes
4
```

5 番目の操作で {1, 2} と {3, 4} が合併し、学生 4 のサークルは 4 人になります。

入力例 2:

```
4 5
3 1 1
2 4
1 2 3
2 3
3 1 3
```

出力例 2:

```
Yes
1
2
No
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「a と b が同じ学生のことはありますか」→ あります。`1 a a` は何もせず、`3 a a` は `Yes` です。
  - 「すでに同じサークルの 2 人を合併したら」→ 何も起きません。人数も変わりません。
  - 「出力が 1 行も無いことは」→ ありません（種類 2 か 3 が必ずある）。
- 見たいこと: 素朴な付け替えの最悪ケース（鎖状の合併）を自分で作って O(N^2) と言えるか。Union-Find の 2 つの工夫（size 併合・経路圧縮）を区別して説明できるか。
- ヒントの出し順:
  1. 「1 1 2、1 2 3、1 3 4、… と合併が続くと、付け替える人数の合計はいくつですか」
  2. 「サークルを、代表者を根にした木で表すと、合併は何をする操作になりますか」
  3. 「木が一本道になったとき、再帰の find はどこまで深くなりますか」
- Python で再帰の find を書いた場合、`sys.setrecursionlimit` を上げれば Python 3.12 以降は深さ 10^5 でも動くことが多い。ただ、反復で書くか size 併合で木を浅く保つほうが確実、と伝える。

## 振り返り用解説（終了後のみ表示）

**想定解答**: Union-Find（素集合データ構造）を使います。`parent[i]`（はじめは i 自身）と、根だけが意味を持つ `size[i]`（はじめは 1）を持ちます。

- find(x): 根に着くまで親をたどる。たどりながら `parent[x] = parent[parent[x]]` として道を半分に縮める（経路半減）。反復で書けば再帰の深さを気にしなくてよい。
- 合併 `1 a b`: ra = find(a)、rb = find(b)。**ra = rb なら何もしない**。そうでなければ、size の小さい根を大きい根の子にして、size を足す。
- `2 a` は size[find(a)]、`3 a b` は find(a) == find(b)。

1 回あたりの計算量はほぼ定数（O(α(N))）で、全体 O((N + Q) α(N))、空間 O(N) です。

**素朴解が落ちる理由**:
- 所属番号を付け替える方式で、a の組を b の組へ大小を見ずに移すと、鎖状の合併（hidden-max-chain）で 1 + 2 + … + (N−1) ≒ 5×10^9 回の付け替えになります（gen/naive.py）。小さい組を大きい組へ移す工夫をすれば O(N log N) で通ります（別解）。
- size 併合をせず `parent[ra] = rb` とつなぐと、hidden-max-chain で深さ 10^5 の一本道の木ができます。つなぐ向きが逆なら hidden-max-chain-rev で同じことが起きます。経路圧縮があっても、圧縮される前の最初の find は 10^5 段の再帰になり、Python（上限 1000）や Node（約 1 万段）では落ちます。
- ra = rb のときにも size を足すと、hidden-trap-remerge で人数が倍になります。

**別解**: 「小さい組の全員を大きい組へ付け替える」方式（weighted quick-find）。1 人が付け替えられるたびに所属する組の大きさが 2 倍以上になるので、1 人あたり高々 log N 回、全体 O(N log N + Q) です。

**言語別の注意**:
- Python: 再帰の find は深さで落ちる。反復で書く。入力はバイト列のトークン（`b"1"`）で比べると速い。
- TypeScript: 再帰の find は約 1 万段でスタックが溢れる。`Int32Array` で parent / size を持つと速い。
- C / Go / Rust: 再帰でも 10^5 段なら多くの環境で動くが、Rust のメインスレッドのスタックは 8MB で、フレームが大きいと危ない。反復で書くのが無難。
- PHP: 再帰の深さに上限は無いが遅くなる。配列を値渡しすると毎回コピーされるので、関数に渡すときは参照（`&$parent`）にするか、クロージャで `use (&$parent)` にする。
