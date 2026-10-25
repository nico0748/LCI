---
id: cp-0013
slug: cheapest-menu-bits
title: "栄養を満たす最安の献立"
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
    text: "料理の選び方は全部で何通りありますか。全部試して間に合いますか"
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
    text: "N ≤ 15 なので料理の選び方は 2^15 = 32768 通り。全部試しても間に合うので bit 全探索と決める（N が 40 なら別の方法が要る）"
    weight: 3
  - id: tp2
    text: "選び方ごとに料理と栄養を数え直すと O(2^N·N·M) ≈ 5×10^6 回。N = 15 なら間に合うが、栄養をビットマスクにすると和集合が OR 1 回、全部そろったかが (1<<M)−1 との比較 1 回で済む"
    weight: 2
  - id: tp3
    text: "料理ごとに栄養のマスクを前計算し、集合 s の OR と合計を「最下位の 1 品を除いた集合」から O(1) で作る。より安い組が出たら数を 1 に戻し、同額なら数を足す"
    weight: 3
  - id: tp4
    text: "エッジケース: どの料理にも無い栄養（-1）、値段 0 の料理（入れても合計が変わらず選び方が倍になる）、栄養を 1 つも含まない料理、合計は最大 1.5×10^10 で 32bit を超える"
    weight: 1
  - id: tp5
    text: "入力は料理ごとに K_i 個の数が続く可変長なので、トークン列としてまとめて読む。サンプル 2（同額 2 通り）に加えて値段 0 の料理を自作して試す"
    weight: 1
requirements:
  - id: min_cost
    label: "栄養 1〜M をすべて含む選び方の最小合計金額を出力する（満たせなければ -1）"
  - id: count_ties
    label: "最小金額になる選び方の数を、料理の集合として正しく数える（値段 0 の料理を含む）"
  - id: int64
    label: "合計金額を 64bit 整数で扱う（最大 1.5×10^10）"
  - id: fast
    label: "N = 15、M = 10 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-ties（安い組が後から見つかったら数え直す）、hidden-trap-zero-price、hidden-trap-64bit が通れば合格ライン"
  explanation: "2^N の見積もりと、ビットマスクで和集合を OR にする理由を言えれば加点。値段 0 の料理で数が倍になる理由まで言えれば満点"
  time_management: "5 分で bit 全探索と宣言、15 分でサンプル 3 件が通る、残りで値段 0・満たせない・64bit を試す"
  red_flags:
    - "合計を 32bit の int で持ち、10^9 円近い料理を 3 品以上足すと溢れる"
    - "より安い組が見つかったときに数を 1 に戻さない（または同額のときに数を足さない）"
    - "値段の安い順・栄養 1 つあたりの値段の順に選ぶ貪欲で、最小を保証しない"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: bit 全探索・ビットマスクの OR / 題材: 社員食堂の献立）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: bit 全探索で集合を被覆する最小コスト問題（技能・部品の被覆）の定番。最小金額になる選び方の数（値段 0 の料理で倍になる）を問う点が独自"
    - "§5 の罠「マスクの OR を使わないと遅い」は N ≤ 15 では TLE にならない（OR を使わない O(2^N·N·M) の Python 版でもこのコンテナで約 0.1 秒）。TLE のケースと gen/naive.* は作らず、talking_points と解説で扱う"
---

## 問題文

社員食堂で、栄養素 1〜M をすべてとれる献立を考えます。料理は N 品あり、料理 i の値段は P_i 円で、K_i 種類の栄養素 A_{i,1}, …, A_{i,K_i} を含みます。

料理を 1 品以上選び（同じ料理は 1 回まで）、選んだ料理のどれかに栄養素 1〜M のそれぞれが含まれるようにします。そのような選び方のうち合計金額が最小のものについて、その金額と、合計がその金額になる選び方が何通りあるかを答えてください。選んだ料理の集合が異なれば、別の選び方として数えます。

どう選んでも条件を満たせないときは `-1` を出力してください。

## 制約

入力:

```
N M
P_1 K_1 A_{1,1} … A_{1,K_1}
P_2 K_2 A_{2,1} … A_{2,K_2}
…
P_N K_N A_{N,1} … A_{N,K_N}
```

出力: 最小の合計金額 X と、合計が X になる選び方の数 Y を `X Y` の形で 1 行。満たせなければ `-1`。

- 1 ≤ N ≤ 15、1 ≤ M ≤ 10
- 0 ≤ P_i ≤ 10^9（値段 0 円の料理もある）
- 0 ≤ K_i ≤ M、1 ≤ A_{i,j} ≤ M。同じ料理の A_{i,1}, …, A_{i,K_i} はすべて異なる
- 入力はすべて整数
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 3
500 2 1 2
300 1 3
700 3 1 2 3
200 1 1
```

出力例 1:

```
700 1
```

料理 3 だけで栄養 1〜3 がそろい 700 円です。料理 1 と 2 の組は 800 円で、ほかの組はもっと高くなります。

入力例 2:

```
3 2
400 1 1
400 1 2
800 2 1 2
```

出力例 2:

```
800 2
```

料理 1 と 2 を選ぶ（800 円）か、料理 3 だけを選ぶ（800 円）かの 2 通りです。

入力例 3:

```
2 3
100 2 1 2
100 1 2
```

出力例 3:

```
-1
```

栄養 3 を含む料理が無いので満たせません。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「1 品も選ばないのは？」→ M ≥ 1 なので条件を満たさない。数えない。
  - 「同じ値段・同じ栄養の料理が 2 品あったら？」→ 番号が違えば別の料理。どちらを選ぶかで別の選び方になる。
  - 「値段 0 の料理は？」→ ある。選んでも選ばなくても合計は同じなので、どちらも数える。
  - 「料理を選ぶ順番は？」→ 関係ない（集合として数える）。
- 見るところ: 2^N の見積もりを最初に言えるか。ビットの添字（栄養 a → ビット a−1）、最小を更新したときの数のリセット、64bit。
- ヒントの出し順:
  1. 「N が 15 なら、選ぶ・選ばないの組合せは何通りですか」
  2. 「料理の栄養を 0/1 の並び（ビット）で表すと、2 品を合わせた栄養はどう計算できますか」
  3. 「最小の金額を更新したとき、数はどうしますか。同じ金額のときは？」
- 貪欲（安い順に足していく）で書き始めたら、サンプル 2 や値段 0 の料理で反例を作れるかを聞く。

## 振り返り用解説（終了後のみ表示）

**想定解**: 料理 i の栄養をビットマスク `mask[i]`（栄養 a をビット a−1）にします。集合 s（1〜2^N−1）を順に見て、最下位の 1 ビット `low = s & -s`（料理 i）を使い、`cover[s] = cover[s ^ low] | mask[i]`、`cost[s] = cost[s ^ low] + P_i` と 1 品少ない集合から O(1) で作ります。`cover[s] == (1 << M) − 1` なら候補で、`cost[s]` が最小より小さければ最小を更新して数を 1 に、等しければ数を 1 増やします。時間 O(2^N)、メモリ O(2^N)。

**素朴解との比較**: 集合ごとに料理 N 品と栄養 M 種を見直す O(2^N·N·M) ≈ 4.9×10^6 回でも、N = 15 なら Python で 0.1 秒程度で間に合います。差が出るのは N が 20〜25 に増えたとき（2^25 × 25 × 10 ≈ 8×10^9）で、ビットマスクの OR と「1 品少ない集合からの差分」が効いてきます。安い順の貪欲は最小を保証しません（サンプル 1 では 200 円の料理から選ぶと 1000 円になる）。

**数え方の注意**: 値段 0 の料理は、入れても入れなくても合計が変わらないので、最小の選び方の数が 2 倍になります。「栄養が増えない料理は選ばない」と枝刈りすると数がずれます（hidden-trap-zero-price・hidden-trap-empty-dish）。

**別解（栄養のマスク上の DP）**: `dp[mask] = (そのマスクちょうどを作る最小金額, その選び方の数)` を料理ごとに更新します（0/1 ナップサックと同じく、更新前の表から作る）。時間 O(N·2^M) = 15 × 1024 で、M が小さく N が大きい場合はこちらが速い。

**言語別の注意**:
- C: 合計は `long long`（10^9 × 15）。数は最大 32767 なので `int` で足りる。
- TypeScript: 1.5×10^10 は Number で正確（2^53 未満）なので BigInt は不要。ビット演算は 32bit だが、マスクは 2^15 未満なので問題ない。
- Go: `int` は 64bit（amd64）。`s & -s` がそのまま使える。
- Rust: 合計は `i64`。`s & s.wrapping_neg()` か `s.trailing_zeros()` で最下位ビット。
- PHP: `int` は 64bit。`1 << $n` も問題ない。
- Python: 溢れない。`(s & -s).bit_length() - 1` で料理の番号。
