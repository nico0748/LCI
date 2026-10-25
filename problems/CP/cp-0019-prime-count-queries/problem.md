---
id: cp-0019
slug: prime-count-queries
title: "抽選番号の素数クエリ"
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
    text: "クエリが 10^5 個、どれも 1〜10^6 の範囲だったら何回の計算になりますか"
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
    text: "R ≤ 10^6、Q ≤ 10^5。クエリごとに L〜R を数えると最悪 10^5 × 10^6 = 10^11 回で C でも間に合わない。前計算してクエリを O(1) にすると宣言する"
    weight: 3
  - id: tp2
    text: "素朴解（各数を √x まで試し割り）は 1 クエリで最大 10^6 × 10^3 回。篩を作ってもクエリごとに数え直すと 10^11 回で TLE（gen/naive.c で約 10 秒以上）"
    weight: 2
  - id: tp3
    text: "エラトステネスの篩で 10^6 までの素数表を O(N log log N) で作り、累積和 pre[x] = 1〜x の素数の個数を作る。答えは pre[R] − pre[L−1]"
    weight: 3
  - id: tp4
    text: "エッジケース: 1 は素数でない（篩の初期化で 0 と 1 を消す）・L = R・L と R がともに素数（両端を含む）・L = 1 のときの pre[0] = 0"
    weight: 1
  - id: tp5
    text: "入出力が 10^5 行ずつあるので、まとめて読み、答えは配列に溜めて 1 回で書く（Python の print を 10^5 回呼ばない）"
    weight: 1
requirements:
  - id: correct_count
    label: "各クエリで L 以上 R 以下の素数の個数を出力する（1 は素数でない、両端を含む）"
  - id: precompute
    label: "篩と累積和を 1 回だけ作り、各クエリを O(1) で答える"
  - id: fast
    label: "Q = 10^5、ほぼ全範囲のクエリでも制限時間内に終わる"
rubric_hints:
  correctness: "hidden-max-wide（10^5 クエリ × ほぼ全範囲）が時間内に終わり、hidden-trap-one-not-prime と hidden-trap-inclusive-ends が通れば合格"
  explanation: "篩の計算量と、累積和で区間の個数が引き算 1 回になる理由を言えれば加点"
  time_management: "5 分で篩＋累積和と宣言、15 分でサンプル 2 件が通る、残りで 1・L = R・最大ケースの速度を試す"
  red_flags:
    - "クエリごとに L〜R を試し割りで数える（10^5 × 10^6 で TLE）"
    - "篩の初期化で 1 を素数のまま残す"
    - "pre[R] − pre[L] と書いて、L 自身が素数のときに 1 つ少なくなる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: エラトステネスの篩＋累積和 / 題材: 商店街の福引きの当たり番号）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 区間の素数の個数を篩と累積和で答える定番。題材と制約（R ≤ 10^6、Q ≤ 10^5）は独自"
    - "出力が最大 600KB になるため tests.json の limits.outputKb を 2048 にしている（期待出力の 2 倍以上、05 §4.3）"
---

## 問題文

商店街の福引きでは、抽選番号が素数の券が当たりです。番号は 1 から 10^6 まであり、Q 軒のお店がそれぞれ番号 L_i から R_i まで（両端を含む）の券を配りました。各お店について、配った券のうち当たりが何枚あるか、つまり L_i 以上 R_i 以下の素数の個数を答えてください。

素数とは、2 以上の整数で、1 とその数自身のほかに正の約数を持たないものです（1 は素数ではありません）。

## 制約

入力:

```
Q
L_1 R_1
L_2 R_2
…
L_Q R_Q
```

出力: Q 行。i 行目に、L_i 以上 R_i 以下の素数の個数。

- 1 ≤ Q ≤ 10^5
- 1 ≤ L_i ≤ R_i ≤ 10^6
- 入力はすべて整数
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3
1 10
11 11
14 16
```

出力例 1:

```
4
1
0
```

1〜10 の素数は 2, 3, 5, 7 の 4 個です（1 は素数ではありません）。11 は素数なので 1 個、14〜16 には素数がありません。

入力例 2:

```
2
20 30
1 100
```

出力例 2:

```
2
25
```

20〜30 の素数は 23 と 29 の 2 個、1〜100 には 25 個あります。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「1 は素数ですか」→ 素数ではない。
  - 「L > R のクエリは？」→ 無い。L = R はある。
  - 「同じ範囲のクエリが何度も来ますか」→ ありうる。
  - 「R の上限は？」→ 10^6。篩はそこまで作れば足りる。
- 見るところ: クエリの数を掛けた見積もり（10^5 × 10^6）を最初に言えるか。篩の初期化（0 と 1）と累積和の添字（L−1）。
- ヒントの出し順:
  1. 「クエリが 10^5 個あるとき、1 個あたり何回の計算までなら間に合いますか」
  2. 「10^6 までの素数を一度にまとめて見つける方法は？（倍数を消していく）」
  3. 「1〜x の素数の個数を表にしておくと、L〜R の個数はどう求まりますか」

## 振り返り用解説（終了後のみ表示）

**想定解**: R の最大値 N（≤ 10^6）まで篩を作ります。`is_p` を 1 で初期化して 0 と 1 を 0 にし、i = 2 から i² ≤ N の範囲で、`is_p[i]` なら i² から i おきに 0 にします。次に `pre[x] = pre[x−1] + is_p[x]`（pre[0] = 0）。各クエリの答えは `pre[R] − pre[L−1]`。前計算 O(N log log N)、クエリ O(1)、全体 O(N log log N + Q)。

**素朴解が落ちる理由**:
- 試し割り: 1 つの数で O(√x)、1 クエリで O((R−L+1)√R)。最大 10^6 × 10^3 = 10^9 回のクエリが 10^5 個（gen/naive.py）。
- 篩は作るが累積和を作らず、クエリごとに L〜R を数え直す: O(Q·(R−L+1)) = 10^11 回。C でも 10 秒以上かかる（gen/naive.c、hidden-max-wide / hidden-max-random）。

**よくある誤り**: 1 を素数として数える（hidden-trap-one-not-prime）、`pre[R] − pre[L]` で L が素数のときに 1 つ少ない、`pre[R−1]` で R が抜ける（hidden-trap-inclusive-ends・hidden-trap-l-equals-r）。

**別解**: 素数を昇順に並べたリストを作り、クエリごとに二分探索で「R 以下の個数 − L 未満の個数」を求める。O(Q log π(N))（π(10^6) = 78498）。

**言語別の注意**:
- Python: `bytearray` とスライス代入 `is_p[i*i::i] = bytes(len(range(i*i, N+1, i)))` で篩が速い（10^6 で 0.05 秒程度）。累積和は `itertools.accumulate`。出力は `"\n".join`。
- TypeScript: `Uint8Array(N + 1)` と `Int32Array(N + 1)`。入力は `split(/\s+/)` でまとめて分ける。
- C: `static char is_p[1000001]` と `static int pre[1000001]`。i * i の計算は i ≤ 1000 なので int で足りる。
- Go: `bufio.NewReader` と `bufio.NewWriter` を使う（`fmt.Scan` を 2×10^5 回呼ぶと遅い）。
- Rust: `read_to_string` してから `split_ascii_whitespace`。出力は `String` に溜めるか `BufWriter`。
- PHP: 篩は `array_fill` か `str_repeat` の文字列（`$s[$j] = "0"`）で作る。出力は `implode("\n", $out)`。
