---
id: cp-0009
slug: lottery-combinations
title: "くじ引きの組合せ数"
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
    text: "クエリごとに r 回掛け算する方法は、この制約で間に合いますか"
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
    text: "Q = 10^5、n ≤ 10^6 なので、クエリごとに O(r) 掛けると最悪 10^5 × 5×10^5 = 5×10^10 回。前計算 O(max n) ＋ 各クエリ O(1) にする"
    weight: 3
  - id: tp2
    text: "素朴解: クエリごとに n(n−1)…(n−r+1) / r! を計算すると 1 クエリ O(r)。パスカルの三角形は 10^6 × 10^6 の表になり、時間もメモリも足りない"
    weight: 2
  - id: tp3
    text: "観察: 998244353 は素数なので a の逆元は a^(P−2)（フェルマーの小定理、繰り返し二乗法で O(log P)）。fact と inv_fact を 10^6 まで前計算し、nCr = fact[n] × inv_fact[r] × inv_fact[n−r]"
    weight: 3
  - id: tp4
    text: "エッジ: r > n は 0、r = 0 と r = n は 1、n = 0。剰余どうしの積は約 10^18 で int32 も double の 2^53 も超えるので 64bit 整数（TS は BigInt か分割乗算）"
    weight: 1
  - id: tp5
    text: "10^5 行をまとめて読み、答えを溜めて 1 回で出す。自作入力として C(5, 2) = 10、C(3, 5) = 0、C(10^6, 1) = 10^6 を確かめる"
    weight: 1
requirements:
  - id: correct_mod
    label: "各クエリについて nCr を 998244353 で割った余りを出力する"
  - id: r_gt_n
    label: "r > n のとき 0、r = 0 や r = n のとき 1 を出力する"
  - id: exact_product
    label: "剰余どうしの積を 64bit 整数（TypeScript では BigInt など）で正確に計算する"
  - id: within_limit
    label: "Q = 10^5、n = 10^6 で制限時間内に終わる（前計算＋各クエリ O(1)）"
rubric_hints:
  correctness: "hidden-max-half（TLE）、hidden-trap-r-gt-n、hidden-trap-64bit と hidden-trap-number-precision（積の精度）が通れば合格"
  explanation: "逆元が必要な理由（mod の世界では割り算ができない）と、998244353 が素数だからフェルマーの小定理が使えることを説明できれば加点"
  time_management: "8 分で階乗の前計算と逆元の方針を宣言し、18 分でサンプル 2 件が通り、残りで r > n と n = 10^6 を試す"
  red_flags:
    - "クエリごとに r 回掛け算する（hidden-max-half で TLE）"
    - "TypeScript で a * b % 998244353 を Number のまま計算し、2^53 を超えて下位の桁が狂う"
    - "C で int どうしを掛けてから long long に代入する（掛けた時点で溢れる）"
    - "r > n のときに inv_fact[n − r] の負の添字を読む"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 階乗の前計算・フェルマーの小定理による逆元 / 題材: 商店街の福引きで景品の組み合わせ数を発表する）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 階乗と逆元の前計算で nCr mod p を答えるのは競技プログラミングの定番技法そのもの。題材と制約の組み合わせは独自"
---

## 問題文

商店街の福引きでは、景品の候補 n 種類から r 種類を選んで詰め合わせを作ります。係の人は、いろいろな (n, r) について、詰め合わせの作り方が何通りあるかを調べています。

Q 個の質問 (n_i, r_i) が与えられます。それぞれについて、n_i 種類の中から r_i 種類を選ぶ組み合わせの数 n_i C r_i を、998244353 で割った余りを求めてください。r_i > n_i のときは選び方が無いので 0 とします。なお、n C 0 = 1 です（0 C 0 も 1）。

## 制約

入力:

```
Q
n_1 r_1
n_2 r_2
…
n_Q r_Q
```

出力: Q 行出力してください。i 行目には n_i C r_i を 998244353 で割った余りを出力します。

- 1 ≤ Q ≤ 10^5
- 0 ≤ n_i ≤ 10^6
- 0 ≤ r_i ≤ 10^6
- 入力はすべて整数
- 998244353 は素数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3
5 2
10 0
3 5
```

出力例 1:

```
10
1
0
```

入力例 2:

```
3
1000000 500000
100 50
0 0
```

出力例 2:

```
666172069
198626801
1
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「r が n より大きいことはありますか」→ あります。そのときは 0 です。
  - 「n = 0 はありますか」→ あります。0 C 0 = 1、0 C 1 = 0 です。
  - 「998244353 は素数ですか」→ はい（制約に書いてある）。
- 見たいこと: Q × r の回数を計算して前計算に切り替える判断を言葉にするか。mod の割り算を逆元に置き換える理由を説明できるか。TypeScript を選んだ場合に、積が 2^53 を超えることに自分で気づくか。
- ヒントの出し順:
  1. 「同じ n! を何度も計算していませんか。先に全部作っておけませんか」
  2. 「mod の世界で r! で割るには、何を掛ければよいですか。998244353 が素数であることは使えませんか」
  3. 「998244352 × 998244352 はいくつですか。その型で正確に持てますか」
- TypeScript で BigInt を使うと遅くなるのではと心配された場合: 前計算 2×10^6 回と 3×10^5 回の掛け算なら BigInt でも 1 秒前後で間に合う。16bit に分けて Number で掛ける方法もある、と伝える。

## 振り返り用解説（終了後のみ表示）

**想定解答**: P = 998244353 として、M = max(n_i) まで `fact[i] = i! mod P` を作ります。`inv_fact[M] = fact[M]^(P−2) mod P`（フェルマーの小定理、繰り返し二乗法）を求めたら、`inv_fact[i−1] = inv_fact[i] × i mod P` で逆向きに埋めます。各クエリは r > n なら 0、そうでなければ `fact[n] × inv_fact[r] % P × inv_fact[n−r] % P` です。時間 O(M + log P + Q)、空間 O(M)。

**素朴解が落ちる理由**: クエリごとに n(n−1)…(n−r+1) と r! を掛けて最後に 1 回だけ逆元を取る方法は 1 クエリ O(r) です。hidden-max-half（r ≒ 5×10^5 のクエリが 9×10^4 個）では約 4.5×10^10 回になり、Python（gen/naive.py）でも C（gen/naive.c）でも間に合いません。

**よくある誤り**:
- 剰余どうしの積は最大で約 10^18 です。C の `int`、Java / Go の 32bit 型では溢れます。C で `long long` に代入しても、右辺が `int` どうしの積なら掛けた時点で溢れます（hidden-trap-64bit）。
- TypeScript の Number は 2^53（約 9×10^15）までしか整数を正確に表せません。`fact[n] * inv_fact[r] % P` はその範囲を超え、下位の桁が失われます（hidden-trap-number-precision）。一方 `fact[i−1] * i` は 2^30 × 2^20 = 2^50 で収まるので、階乗の前計算だけは Number でも正しく計算できてしまいます。この部分的な正しさが誤りに気づきにくくする原因です。
- r > n で `inv_fact[n − r]` を読むと、負の添字（C では範囲外、Python では後ろから数えた要素）になります（hidden-trap-r-gt-n）。

**別解**: 逆元を `inv[i] = −(P / i) × inv[P mod i] mod P` の漸化式で O(M) で作る方法もあります。クエリが少なければ、毎回 `pow(r! × (n−r)!, P−2)` を計算してもよいです（1 クエリ O(log P)）。

**言語別の注意**:
- C: 配列は `long long` か `unsigned int` で持ち、掛ける前に `(long long)` へ広げる。10^6 要素の配列は `static` か `malloc` で確保する（スタックに置かない）。
- Go: `int` は 64bit なので積が収まる（P^2 < 2^63）。
- Rust: `u64` で掛けて `% P`。
- TypeScript: BigInt（`(a * b) % P` を `bigint` で）か、b を上下 16bit に分けて `(a * (b >>> 16) % P * 65536 + a * (b & 65535)) % P` とする。後者は途中の値が 2^47 未満で Number でも正確。
- PHP: 整数は 64bit で、P^2 < 2^63 なので `$a * $b % P` はそのまま正しい（float に化けない）。
- Python: 整数は多倍長なので溢れない。前計算の for 文 2×10^6 回は 1 秒弱。
