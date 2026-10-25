---
id: cp-0010
slug: nearest-station
title: "最寄り駅までの距離"
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
    text: "家ごとに全部の駅を調べる方法は、この制約で間に合いますか"
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
    text: "N = 2×10^5、Q = 5×10^4 なので全組を見ると 10^10 回。ソート O(N log N) ＋ 家ごとに O(log N) の二分探索で、合計 (N + Q) × 18 回程度に抑える"
    weight: 3
  - id: tp2
    text: "素朴解: 家ごとに全駅との距離を測る O(NQ) = 10^10 回。C でも 1 秒に 10^8〜10^9 回なので数秒以上かかる"
    weight: 2
  - id: tp3
    text: "観察: 駅を昇順に並べると、家 h の最寄りは lower_bound の位置 i の駅（h 以上で最小）か、1 つ前の i−1 の駅（h 未満で最大）のどちらか。この 2 つだけ比べればよい"
    weight: 3
  - id: tp4
    text: "エッジ: 家が先頭の駅より手前（i = 0）、末尾の駅より先（i = N）、駅とちょうど同じ座標（距離 0）、同じ座標の駅が並ぶ、駅が 1 つだけ"
    weight: 1
  - id: tp5
    text: "駅は 1 行、家は 1 行に 1 つ。TypeScript の sort は比較関数を渡さないと文字列順（10 が 9 より前）になるので (a, b) => a − b を渡す。駅 10 9 100 の入力を自作して確かめる（サンプルはどちらも桁数がそろっていて、この誤りでは落ちない）"
    weight: 1
requirements:
  - id: nearest
    label: "各家から最も近い駅までの距離を、家の順に 1 行ずつ出力する"
  - id: boundaries
    label: "先頭の駅より手前・末尾の駅より先・駅と同じ座標にある家でも正しい"
  - id: unsorted_input
    label: "駅が座標の順に並んでいない入力や、同じ座標の駅がある入力を正しく扱う"
  - id: within_limit
    label: "N = 2×10^5、Q = 5×10^4 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-max-1（TLE）、hidden-trap-before-first / after-last（範囲外）、hidden-trap-duplicates、hidden-trap-sort-digits（数値としてのソート）が通れば合格"
  explanation: "lower_bound が返す位置の意味（h 以上で最初の要素）と、なぜ i と i−1 の 2 つだけ見ればよいかを説明できれば加点"
  time_management: "6 分でソート＋二分探索の方針と、比べる 2 つの駅（i−1 と i）を宣言し、16 分でサンプル 2 件が通り、残りで両端の外の家と同じ座標の駅を試す"
  red_flags:
    - "家ごとに全駅を調べる（hidden-max-1 で TLE）"
    - "TypeScript で xs.sort() を比較関数なしで呼び、数値が文字列順に並ぶ"
    - "lower_bound の位置 i が 0 や N のときに xs[i−1] や xs[i] を範囲外で読む"
    - "自作の二分探索で lo / hi の更新を誤り、同じ座標の駅が続くと 1 つ隣を返す"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: ソート＋二分探索（lower_bound）/ 題材: 線路沿いの家から最寄り駅までの距離）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「ソート済み配列で最も近い値を探す」二分探索の定番。題材と入出力は独自"
---

## 問題文

一直線の線路沿いに N 個の駅があり、i 番目の駅は座標 x_i にあります。駅は座標の順に並んで与えられるとは限らず、同じ座標に複数の駅があることもあります。

線路沿いには Q 軒の家もあり、j 軒目の家は座標 h_j にあります。各家について、その家から最も近い駅までの距離（座標の差の絶対値）を求めてください。

## 制約

入力:

```
N Q
x_1 x_2 … x_N
h_1
h_2
…
h_Q
```

出力: Q 行出力してください。j 行目には、j 軒目の家から最も近い駅までの距離を出力します。

- 1 ≤ N ≤ 2×10^5
- 1 ≤ Q ≤ 5×10^4
- 0 ≤ x_i ≤ 10^9
- 0 ≤ h_j ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 4
9 2 6
1
4
7
12
```

出力例 1:

```
1
2
1
3
```

座標 4 の家は、座標 2 の駅と座標 6 の駅のどちらにも 2 離れているので、答えは 2 です。

入力例 2:

```
4 3
30 30 80 45
30
60
100
```

出力例 2:

```
0
15
20
```

座標 30 の家は駅と同じ位置にあるので、答えは 0 です。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「駅は座標順に並んでいますか」→ 並んでいるとは限りません。
  - 「家と駅が同じ座標のことは」→ あります。距離は 0 です。
  - 「家は座標順ですか」→ 順不同です。出力は入力の家の順です。
- 見たいこと: 10^10 回を見積もってソートを選ぶか。二分探索の結果の位置 i が 0 や N になる場合を、書く前に言葉にするか。
- ヒントの出し順:
  1. 「駅が座標の順に並んでいたら、家の左右にある駅はどう見つけられますか」
  2. 「家の座標以上で最初の駅の位置を i とすると、最寄りの候補はどれとどれですか」
  3. 「家が一番左の駅より左にあるとき、i はいくつになりますか」
- cp-0003（本棚）も二分探索の問題だが、あちらは「答えの値を探す」型。こちらは「ソート済みの配列の中で位置を探す」型である点を区別して説明できるかも見る。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 駅の座標を昇順にソートします。家 h ごとに lower_bound（Python なら `bisect_left`）で「h 以上で最初の駅」の位置 i を求めます。最寄りの駅は xs[i]（h 以上で最も近い）か xs[i−1]（h 未満で最も近い）のどちらかなので、存在するほうだけを比べます（i = 0 なら xs[0] だけ、i = N なら xs[N−1] だけ）。時間 O(N log N + Q log N)、空間 O(N)。

**素朴解が落ちる理由**: 家ごとに全駅を調べると、hidden-max-1 で 2×10^5 × 5×10^4 = 10^10 回の比較になります（gen/naive.py）。

**よくある誤り**:
- TypeScript / JavaScript の `Array.prototype.sort()` は、比較関数を渡さないと要素を文字列として並べます。`[9, 10, 100]` は `[10, 100, 9]` になり、その上で二分探索すると答えが狂います（hidden-trap-sort-digits）。`(a, b) => a - b` を渡すか、`Int32Array` / `Float64Array` に入れて `sort()` します（型付き配列の sort は数値順）。
- i = 0 で xs[i−1]、i = N で xs[i] を読む範囲外アクセス（hidden-trap-before-first / hidden-trap-after-last）。
- 自作の二分探索で `xs[mid] == h` のときの更新を誤り、同じ座標の駅が並ぶと 1 つ隣を返す（hidden-trap-duplicates）。

**別解**: 家も座標でソートし、駅と家を 2 本のポインタで同時に左から走査すれば、ソート後は O(N + Q) で答えられます。ただし答えを元の家の順に戻すため、家の番号を覚えておく必要があります。

**言語別の注意**:
- C: `qsort` の比較関数で `return a - b;` と書くと、差が int の範囲を超えて符号が狂うことがある（この問題の座標 10^9 では差が int に収まるが、`(a > b) - (a < b)` が安全）。lower_bound は自分で書く。
- Go: `sort.Ints` と `sort.SearchInts`（lower_bound と同じ意味）。
- Rust: `sort_unstable` と `partition_point(|&x| x < h)`。
- TypeScript: 比較関数つきの sort。lower_bound は自分で書く。
- PHP: `sort($xs)`（数値の配列なら数値順）。lower_bound は自分で書く。
- Python: `bisect.bisect_left`。入力は `sys.stdin.buffer.read().split()` でまとめて読む。
