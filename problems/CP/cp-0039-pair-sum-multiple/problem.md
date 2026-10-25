---
id: cp-0039
slug: pair-sum-multiple
title: "和が M の倍数になるペア"
category: CP
tier: core
difficulty: L2
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
    text: "全部の組を調べるやり方は、この制約で間に合いますか"
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
    text: N ≤ 2×10^5 なので O(N) か O(N log N) が目標。C で 1 秒に 10^8 回、Python で 10^7 回が目安と宣言する
    weight: 3
  - id: tp2
    text: 素朴解の全ペア判定は N(N−1)/2 ≈ 2×10^10 組で TLE（C でも 64bit の剰余を 2×10^10 回は間に合わない）
    weight: 2
  - id: tp3
    text: (A_i + A_j) mod M = 0 ⇔ 余りが r と (M − r) mod M。左から見て「それまでに見た余り (M − r) mod M の個数」を足し、余り r の個数を 1 増やす。M ≤ 10^9 なので個数はハッシュマップで数える
    weight: 3
  - id: tp4
    text: 余り 0 どうしと、M が偶数のときの余り M/2 どうしは c(c−1)/2 組（積 c×c で数えると二重）、M=1、答えは最大約 2×10^10 で 64bit、を列挙する
    weight: 1
  - id: tp5
    text: 2×10^5 個の整数をまとめて読む。入力例 1 の余り（1, 3, 2, 2, 0）で手計算し、全員が M の倍数の入力を自作して c(c−1)/2 になるか試す
    weight: 1
requirements:
  - id: correct_output
    label: (A_i + A_j) mod M = 0 となる組 i < j の個数を出力する（無ければ 0）
  - id: special_residues
    label: 余り 0 どうし・余り M/2 どうしの組を、自分自身との組や二重数えなしに数え、M = 1 も正しく扱う
  - id: wide_integers
    label: 答え（最大約 2×10^10）を 64bit 整数で扱い、M ≤ 10^9 でも大きさ M の配列を取らない
  - id: within_limit
    label: N=2×10^5 で制限時間内に終わる（O(N^2) にしない）
rubric_hints:
  correctness: "hidden-max-*（O(N^2) の TLE）、hidden-trap-half-residue / zero-residue（二重数え）、hidden-trap-int64（32bit の溢れ）、hidden-trap-large-m（大きさ M の配列）が通れば合格"
  explanation: "「和が M の倍数 ⇔ 余りの和が 0 か M」と言い換え、左から数える方法なら r = 0 と r = M/2 を場合分けせずに済む理由を説明できれば加点"
  time_management: "8 分で余りの数え上げを宣言し、18 分以内に入力例 1〜3 が通る"
  red_flags:
    - "計算量を言わずに全ペアの二重ループを書き始める"
    - "余りごとの個数 c[r] × c[M−r] を r = 0 や r = M/2 にもそのまま使い、自分自身との組や同じ組を二重に数える"
    - "答えを 32bit の int で数え、全員が M の倍数のときに溢れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 余りによる数え上げ（ハッシュマップ） / 題材: あめの袋を 2 つずつ箱詰めする）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「和が M の倍数になる組の数」は余りの数え上げの定番。M を 10^9 まで許して配列を取れなくし、余り 0 と M/2 の扱いを隠しテストで突く形にした"
    - "C の素朴解を、余りを先に計算して r_i + r_j ∈ {0, M} を比べる形に書くと、コンパイラのベクトル化で 2×10^10 組でも数秒に縮む可能性がある（gen/naive.c は剰余をループ内で取る素直な形）"
---

## 問題文

あめの袋が N 個あり、袋 i にはあめが A_i 個入っています。袋を 2 つ選んで 1 箱にまとめて出荷します。箱の中のあめは M 個入りの小分け袋に詰め替えるので、2 袋のあめの合計が M の倍数のときだけ、余りを出さずに詰め替えられます。

余りを出さずに詰め替えられる 2 袋の選び方、つまり (A_i + A_j) を M で割った余りが 0 になる組 (i, j)（1 ≤ i < j ≤ N）の個数を求めてください。

## 制約

入力:

```
N M
A_1 A_2 … A_N
```

出力: 条件を満たす組の個数（最後に改行を付ける）

- 2 ≤ N ≤ 2×10^5
- 1 ≤ M ≤ 10^9
- 1 ≤ A_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 4
1 3 2 6 4
```

出力例 1:

```
2
```

入力例 2:

```
4 5
5 10 15 20
```

出力例 2:

```
6
```

入力例 3:

```
3 10
1 2 3
```

出力例 3:

```
0
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「同じ袋を 2 回選んでもいいですか」→ だめ。i < j の 2 つの異なる袋。
  - 「A_i が同じ値の袋は区別しますか」→ する。袋の番号が違えば別の組（入力例 2 は 4 袋から 2 つで 6 通り）。
  - 「M = 1 はありますか」→ ある。そのときはすべての組が条件を満たす。
- 入力例 1: 余りは 1, 3, 2, 2, 0。余り 1 と 3 の組（袋 1 と 2）、余り 2 どうしの組（袋 3 と 4）で 2 組。余り 0 は 1 袋しかないので組めない。
- ヒントの出し順:
  1. 「和が M の倍数かどうかは、A_i そのものではなく何だけで決まりますか」
  2. 「余り r の袋と組める袋の余りは何ですか。r = 0 のときは」
  3. 「左から順に見て、それまでに見た袋の余りの個数を覚えておくと、組を 1 回ずつ数えられませんか」
- M ≤ 10^9 なので、余りの個数を大きさ M の配列で持つと 4〜8GB でメモリ不足になる。辞書（ハッシュマップ）か、余りをソートして数える。

## 振り返り用解説（終了後のみ表示）

**想定解答**: (A_i + A_j) mod M = 0 ⇔ (A_i mod M) + (A_j mod M) が 0 か M、つまり余り r の袋と組めるのは余り (M − r) mod M の袋です。袋を左から順に見て、`ans += cnt[(M − r) mod M]` してから `cnt[r] += 1` とすれば、各組 i < j を j の位置でちょうど 1 回ずつ数えます。この書き方なら、余り 0 どうしや M が偶数のときの余り M/2 どうしも、場合分けなしで c(c−1)/2 組になります。M ≤ 10^9 なので cnt はハッシュマップで持ち、全体で O(N) です。

**素朴解が落ちる理由**: 全ペアを調べると N(N−1)/2 ≈ 2×10^10 組で、C でも 64bit の剰余をそれだけ繰り返すと間に合いません（hidden-max-*）。余りごとの個数を先に数えて `c[r] × c[M−r]` を足す方法は正しく書けば O(N) ですが、r = 0 や r = M/2 で自分自身と組ませたり、r と M − r の両方から同じ組を二重に数えたりしやすく、hidden-trap-half-residue と hidden-trap-zero-residue で WA になります。

**別解**: 余りを全部求めてソートし、同じ余りの塊ごとに個数を数えてから、r < M − r の組は c[r] × c[M − r]、r = 0 と r = M/2 は c(c−1)/2 を足します（O(N log N)）。ハッシュマップが使いにくい C ではこちらが書きやすいです。

**言語別の注意**:
- C: 標準ライブラリにハッシュマップが無いので、余りを `qsort` してから数えるのが簡単。答えは `long long`。
- Go / Rust: `map[int64]int64` / `HashMap<u64, u64>`。答えは 64bit。Rust の `HashMap` は既定のハッシュでも 2×10^5 件なら十分速い。
- TypeScript: 答えは最大約 2×10^10 で 2^53 未満なので Number で正確。`Map<number, number>` を使い、`{}` のオブジェクトを辞書代わりにするなら値の取り出しで `?? 0` を忘れない。
- Python: `dict.get(key, 0)`。A_i + A_j の和は Python では溢れないが、C 系の素朴解では 2×10^9 が 32bit を超える。
- PHP: 配列のキーは整数のまま使える。答えは 64bit の int で溢れない。
