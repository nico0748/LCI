---
id: cp-0038
slug: sorter-cycle-sum
title: "仕分け機の K 回後の合計"
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
    text: "K 回そのまま動かすと、どれくらい時間がかかりますか"
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
    text: K ≤ 10^18 なので K に比例する方法は使えない。N ≤ 2×10^5 なので、たどる経路の長さ（高々 N）に比例する O(N) が目標と宣言する
    weight: 3
  - id: tp2
    text: 素朴解の「K 回そのまま移動する」は 10^18 回で、C でも 1 秒に 10^8〜10^9 回なので数百年かかる
    weight: 2
  - id: tp3
    text: 行き先が 1 つに決まるので、仕分け機 1 からの経路は高々 N 回で同じ仕分け機に戻り、尾 μ ＋ 周期 λ の ρ 型になる。初訪問の順番を記録し、累積和で「尾の和 ＋ 周期の和 × q ＋ 余り r 回分」を計算する
    weight: 3
  - id: tp4
    text: K が尾より短い（周期の式に入れない）、K がちょうど μ や μ+λ、自己ループ（λ=1）、周期の和 × q は 10^26 にもなるので q を mod してから掛ける、を列挙する
    weight: 1
  - id: tp5
    text: K は 10^18 で TypeScript の Number（2^53 まで）では正確に読めないので BigInt で読む。小さい K で素朴なシミュレーションと突き合わせて確かめる
    weight: 1
requirements:
  - id: correct_output
    label: K 回の移動の後にいる仕分け機の番号と、記録された手数料の合計を 10^9+7 で割った余りを出力する
  - id: tail_and_cycle
    label: K が周期に入る前に終わる場合や、ちょうど尾・周期の境目で終わる場合も正しい
  - id: big_k
    label: K ≤ 10^18 を正確に扱い（TS は BigInt）、周期の和 × 周回数で 64bit が溢れない
  - id: within_limit
    label: N=2×10^5、K=10^18 で制限時間内に終わる（K 回のシミュレーションをしない）
rubric_hints:
  correctness: "hidden-max-*（K 回のシミュレーションの TLE）、hidden-trap-k-in-tail（尾の途中で終わる）、hidden-trap-overflow-mul（64bit の積）、hidden-trap-bigint-k（TS の Number 精度）が通れば合格"
  explanation: "ρ 型になる理由（行き先が 1 つで状態が N 個しかない）と、K − μ を λ で割った商と余りへの分解を図で説明できれば加点"
  time_management: "12 分で ρ 型と周期の計算を宣言し、30 分以内に入力例 1・2 が通る。残りで K が尾より短いケースを自作する"
  red_flags:
    - "計算量を言わずに K 回の for ループを書き始める"
    - "K < μ（周期に入る前に終わる）でも周期の式に入れ、K − μ が負になって添字や合計が壊れる"
    - "周期の和 × 周回数を mod せずに 64bit で掛けて溢れる、または TypeScript で K を Number で読んで 10^18 − 1 が 10^18 に丸まる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 関数グラフの周期検出（ρ 型）と累積和 / 題材: 行き先が決まった物流センターの仕分け機）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「行き先が決まったグラフを K 回たどる（K は巨大）」は周期検出・ダブリングの定番。位置に加えて通過した値の合計（mod）も求めさせ、尾の途中で終わる場合と 64bit の積を突く形にした"
---

## 問題文

物流センターに N 台の仕分け機（1〜N 番）があります。仕分け機 i に荷物が届くと、手数料 A_i 円が記録され、荷物は仕分け機 T_i へ送られます（T_i = i のこともあります）。

荷物を 1 個、仕分け機 1 に入れます。「今いる仕分け機の手数料を記録し、荷物を次の仕分け機へ送る」ことを 1 回の移動とし、これを K 回行います。

K 回の移動の後に荷物がいる仕分け機の番号と、記録された K 回分の手数料の合計を 10^9+7 で割った余りを求めてください。

## 制約

入力:

```
N K
T_1 T_2 … T_N
A_1 A_2 … A_N
```

出力: 仕分け機の番号と、手数料の合計を 10^9+7 で割った余りを空白区切りで出力する（最後に改行を付ける）

- 1 ≤ N ≤ 2×10^5
- 1 ≤ K ≤ 10^18
- 1 ≤ T_i ≤ N
- 0 ≤ A_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 5
2 3 4 2
10 20 30 40
```

出力例 1:

```
3 120
```

入力例 2:

```
3 1000000
2 3 2
1000000000 1 2
```

出力例 2:

```
3 1499991
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「最初の仕分け機 1 の手数料も記録しますか」→ する。1 回目の移動で A_1 を記録して T_1 へ送る。K 回の移動で記録されるのは K 個。
  - 「合計は mod を取る前に比べますか」→ 比べない。合計を 10^9+7 で割った余りだけを出す。
  - 「仕分け機 1 が周期の上にあるとは限らないですか」→ 限らない（入力例 2 では 1 は尾で、周期は 2 → 3 → 2）。
- 入力例 1 の流れ: 1 → 2 → 3 → 4 → 2 → 3。記録は 10, 20, 30, 40, 20 で合計 120、5 回の後は仕分け機 3。
- 入力例 2: 尾は仕分け機 1 の 1 台（μ = 1）、周期は 2 → 3（λ = 2、周期の和 3）。K − μ = 999999 = 2 × 499999 + 1 なので、合計は 10^9 + 3 × 499999 + 1 = 1001499998、10^9+7 で割った余りは 1499991。位置は周期の 1 番目（仕分け機 3）。入力例は素朴なシミュレーションでも終わる大きさにしてあり、隠しテストは K ≈ 10^18。
- ヒントの出し順:
  1. 「仕分け機は N 台しかありません。たどっていくと、いつか何が起きますか」
  2. 「初めて同じ仕分け機に戻ったとき、それまでの経路はどんな形をしていますか」（尾と周期の ρ 型）
  3. 「K を『尾の分』と『周期を q 周』と『余り r 回』に分けると、合計はどう書けますか。q × 周期の和は 64bit に収まりますか」
- TypeScript を選んだ場合: 「10^18 − 1 を Number で表すとどうなりますか」と聞く（2^53 ≈ 9×10^15 を超える）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 仕分け機 1 から T をたどり、各仕分け機を初めて訪れた順番 `first[x]`（何回目の移動の前にいたか）と訪問順の列 `order` を記録します。初めて訪問済みの仕分け機 x に戻ったら、尾の長さ μ = first[x]、周期の長さ λ = len(order) − μ です。手数料の累積和 `pre[j]`（最初の j 回の移動の合計）も作ります。

- K ≤ μ + λ なら、記録した列をそのまま使います。位置は `T[order[K−1]]`、合計は `pre[K]`。
- それ以外なら `K − μ = qλ + r`（0 ≤ r < λ）と分け、合計は `pre[μ] + q × (pre[μ+λ] − pre[μ]) + (pre[μ+r] − pre[μ])`、位置は `order[μ + r]` です。

q は最大で約 10^18、周期の和は最大で 2×10^14 なので、`(q mod p) × (周期の和 mod p)` のように両方を mod してから掛けます（どちらも 10^9+7 未満なら積は約 10^18 で 64bit に収まる）。たどるのは高々 N 回なので O(N) です。

**素朴解が落ちる理由**: K 回そのまま移動すると O(K) で、K = 10^18 では C でも終わりません（hidden-max-*）。周期を使う式を K < μ のときにも使うと、K − μ が負になって位置も合計も壊れます（hidden-trap-k-in-tail）。

**別解（ダブリング）**: `nxt[j][v]` = v から 2^j 回進んだ先、`sum[j][v]` = その間の合計、を j = 0..59 について作り、K を 2 進数で分解して進めます。O(N log K) ≈ 1.2×10^7 回ですが、表が 60 × 2×10^5 になり、Python ではメモリと時間が厳しくなります。

**言語別の注意**:
- TypeScript: K は `BigInt(tokens[1])` で読む。`K − μ`、`/ λ`、`% λ` も BigInt で計算し、余り r（λ 未満）は `Number(r)` に戻して添字に使う。`q mod p` と周期の和 mod p の積は 10^18 程度で 2^53 を超えるので、ここも BigInt で掛ける。
- C / Go / Rust: K は `long long` / `int64` / `u64` で読める（10^18 < 9.2×10^18）。累積和は 2×10^14 まで、積は必ず mod を取ってから。
- Python: 整数は溢れないが、最後に必ず `% (10**9 + 7)` を取る。経路の記録はループで行う（再帰にしない）。
- PHP: 整数は 64bit。`intdiv` と `%` で商と余りを取り、積の前に mod する（`(q % p) * (cyc % p)` は約 10^18 で PHP_INT_MAX 未満）。
