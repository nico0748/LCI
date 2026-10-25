---
id: cp-0005
slug: sales-excluding-holidays
title: "休業日を除いた期間売上"
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
    text: "この制約だと、期間ごとに 1 日ずつ足す方法は間に合いますか"
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
    text: "N = 2×10^5、Q = 5×10^4 なので、期間ごとに足すと最悪 N×Q = 10^10 回。前計算 O(N) ＋ 各期間 O(1) の O(N + Q) にする"
    weight: 3
  - id: tp2
    text: "素朴解（期間ごとに L..R を 1 日ずつ足す）は Python なら 1 秒に 10^7 回程度で 1000 秒かかる。C でも 10^10 回は数十秒（gen/naive.c で約 27 秒）"
    weight: 2
  - id: tp3
    text: "観察: 売上（休業日は 0 として）と営業日数（A_i ≥ 0 なら 1）の累積和を 2 本作ると、期間の答えは S[R] − S[L−1] と C[R] − C[L−1]"
    weight: 3
  - id: tp4
    text: "エッジ: 全日休業の期間（0 0）、売上 0 円の営業日（日数には数える）、L = R、L = 1 と R = N、合計 2×10^14 は int32 を超える"
    weight: 1
  - id: tp5
    text: "答えは配列に溜めて最後にまとめて出す。売上を 1, 2, 4, 8, … にした入力を自作すると、両端の 1 日のずれがすぐ分かる"
    weight: 1
requirements:
  - id: correct_sum_count
    label: "各期間について、営業日の売上合計と営業日数を空白区切りで出力する"
  - id: holiday_rules
    label: "休業日（-1）は合計にも日数にも含めず、売上 0 円の営業日は日数に含める"
  - id: inclusive
    label: "期間は両端を含む L..R として計算し、全日休業の期間では 0 0 を出力する"
  - id: within_limit
    label: "N = 2×10^5、Q = 5×10^4 で制限時間内に終わり、合計を 64bit で正しく扱う"
rubric_hints:
  correctness: "hidden-max-full-range（TLE）、hidden-trap-overflow（64bit）、hidden-trap-zero-sales と hidden-trap-minus-one（休業日の扱い）、hidden-trap-inclusive（両端）が通れば合格"
  explanation: "累積和の添字（S[0] = 0 を置き、期間 L..R は S[R] − S[L−1]）を図や式で説明し、素朴解の回数 10^10 と比べられれば加点"
  time_management: "8 分で累積和 2 本の方針と添字を決め、18 分でサンプル 2 件が通り、残りで 1 日だけの期間と全日休業を試す"
  red_flags:
    - "期間ごとに L..R をループで足す（hidden-max-full-range で TLE）"
    - "営業日数を A_i > 0 で数え、売上 0 円の営業日を落とす"
    - "休業日の -1 をそのまま累積和に足す"
    - "累積和を int（32bit）で持つ"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 累積和 2 本 / 題材: 休業日を -1 で記録した店の売上台帳）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

ある店の N 日分の売上台帳があります。i 日目の記録 A_i は、営業した日ならその日の売上（円）、休業日なら `-1` です。営業しても売上が 0 円の日もあります。

Q 個の期間が与えられます。j 番目の期間は L_j 日目から R_j 日目まで（両端の日を含む）です。各期間について、その期間に含まれる営業日の売上の合計と、営業日の日数を求めてください。

## 制約

入力:

```
N Q
A_1 A_2 … A_N
L_1 R_1
L_2 R_2
…
L_Q R_Q
```

出力: Q 行出力してください。j 行目には、j 番目の期間の売上合計と営業日数を、この順に空白区切りで出力します。

- 1 ≤ N ≤ 2×10^5
- 1 ≤ Q ≤ 5×10^4
- A_i = -1、または 0 ≤ A_i ≤ 10^9
- 1 ≤ L_j ≤ R_j ≤ N
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
7 3
120 -1 300 0 -1 450 80
1 7
2 5
6 7
```

出力例 1:

```
950 5
300 2
530 2
```

2 番目の期間（2〜5 日目）の営業日は 3 日目と 4 日目です。4 日目は売上 0 円ですが営業日なので、日数に数えます。

入力例 2:

```
4 2
-1 -1 500 -1
1 2
1 4
```

出力例 2:

```
0 0
500 1
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「売上 0 円の日は営業日ですか」→ はい。-1 だけが休業日です。
  - 「期間は両端を含みますか」→ 含みます（L = R なら 1 日だけ）。
  - 「期間に営業日が無いときは」→ `0 0` です。
- 見たいこと: N×Q = 10^10 を自分で計算して、素朴解を捨てる判断を言葉にするか。累積和の添字を 1 ずれさせない工夫（S[0] = 0）を説明するか。
- ヒントの出し順:
  1. 「期間ごとに足すと、最悪で何回の足し算になりますか」
  2. 「1 日目から i 日目までの合計が分かっていたら、L..R の合計はどう出せますか」
  3. 「日数も同じ方法で数えられませんか。休業日と売上 0 円の日を区別できていますか」
- 類題について: 累積和で区間和を答える問題は定番の技法。「-1 が休業日」「0 円の営業日」の組み合わせは独自。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 長さ N + 1 の配列を 2 本作ります。`S[0] = C[0] = 0`、`S[i] = S[i−1] + (A_i ≥ 0 ? A_i : 0)`、`C[i] = C[i−1] + (A_i ≥ 0 ? 1 : 0)`。期間 L..R の答えは `S[R] − S[L−1]` と `C[R] − C[L−1]` です。時間 O(N + Q)、空間 O(N)。

**素朴解が落ちる理由**: 期間ごとに L..R を足すと、hidden-max-full-range（ほぼ全期間 × 5×10^4 個）で約 10^10 回になります。Python（gen/naive.py）は当然、C（gen/naive.c）でもこのコンテナで約 27 秒かかり、制限を大きく超えます。

**よくある誤り**:
- 営業日数を `A_i > 0` で数える → 売上 0 円の営業日を落とす（hidden-trap-zero-sales）。
- -1 をそのまま累積和に足す → 休業日の数だけ合計が小さくなる（hidden-trap-minus-one）。
- 累積和を 32bit で持つ → 10^9 × 2000 日で溢れる（hidden-trap-overflow）。
- 期間を `S[R] − S[L]` にする → L 日目が抜ける（hidden-trap-inclusive。売上が 2 の累乗なので 1 日のずれで必ず値が変わる）。

**別解**: 休業日の日数の累積和を作り、営業日数を「期間の日数 − 休業日数」としてもよいです。Fenwick 木（BIT）でも答えられますが、更新が無いので累積和で十分です。

**言語別の注意**:
- C: 累積和は `long long`。出力は `printf` を 5×10^4 回呼んでも十分速いが、`scanf` より `fread` でまとめて読むほうが速い。
- Go: `int` は 64bit。`bufio.Writer` に書いて最後に `Flush` する（`fmt.Println` を直接呼ぶと遅い）。
- TypeScript: 2×10^14 は 2^53 未満なので Number で正確。`Float64Array` で累積和を持つと速い。
- Python: 出力は `"\n".join` でまとめて書く（1 行ずつ print すると遅くなる）。
- PHP: `explode` / `preg_split` で一括して読み、`implode` で出力する。
