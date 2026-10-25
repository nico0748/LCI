---
id: cp-0030
slug: sale-cooldown-dp
title: "クールダウン付きのタイムセール"
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
    text: "割引の大きい店から順に取っていく方法は、いつも最適になりますか"
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
    text: "N = 2×10^5 なので O(N) か O(N log N)。買う・買わないの全探索は 2^N、「直前に買った店」を全部見る DP も O(N^2) = 2×10^10 回で間に合わないと宣言する"
    weight: 3
  - id: tp2
    text: "割引の大きい順に取る貪欲は、5 6 5（D = 2）で 6 を取って 10 を逃すように最適にならない。反例を挙げてから DP にする"
    weight: 2
  - id: tp3
    text: "dp[i] = 店 1..i だけでの最大とし、dp[i] = max(dp[i−1], dp[i−D] + a_i)（i−D < 0 なら 0）。「買わない」と「買う（直前は店 i−D 以前）」の 2 択で O(N)"
    weight: 3
  - id: tp4
    text: "D = 1（全部買える、和は最大 2×10^14 で 64bit）、D > N（1 店だけ）、D = N、i−D がちょうど 0 の添字の境界を確かめる"
    weight: 1
  - id: tp5
    text: "入力は 2×10^5 個の整数をまとめて読み、答えは 1 行。サンプル 1（5 6 5 1 9 8、D = 2 で 19）を dp の表で手で追う"
    weight: 1
requirements:
  - id: correct_output
    label: "どの 2 店も番号の差が D 以上になるように選んだときの、割引額の合計の最大値を出力する"
  - id: not_greedy
    label: "割引の大きい順の貪欲が最適にならない入力でも、正しい最大値を出す"
  - id: int64
    label: "合計が 2^31 を超えても（最大 2×10^14）正しく扱う"
  - id: within_limit
    label: "N = 2×10^5、D = 1 のような入力でも制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-greedy / greedy-d3（貪欲の WA）・hidden-trap-int64 と hidden-max-d1（64bit）・hidden-trap-d-gt-n が通れば合格ライン。hidden-max-* は O(N^2) の DP を TLE にする"
  explanation: "貪欲の反例を自分で示し、dp の定義と遷移の 2 択を言えれば加点。O(N^2) の DP を「前の最大を持ち回す」ことで O(N) にする流れを説明できるとよい"
  time_management: "10 分以内に貪欲の反例と dp の定義を宣言、20 分以内にサンプル 3 件が通る、残りで D = 1・D > N・64bit を試す"
  red_flags:
    - "反例を確かめずに、割引の大きい順に取る貪欲を書く"
    - "合計を int（32bit）で持ち、D = 1 で溢れる"
    - "dp[i − D] を i − D < 0 のときも参照する（C は範囲外、Python は負の添字で末尾を読む）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 1 次元 DP（選んだら次の D−1 個を飛ばす）/ 題材: 商店街のタイムセール。1 店で買うと次の D−1 店では買えない）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 隣り合う要素を選べない最大和（House Robber 型）の一般化。間隔を D に広げ、D > N や D = 1 を含めて差別化した"
---

## 問題文

商店街に N 軒の店が一列に並んでいて、端から順に店 1, 2, …, N と番号が付いています。今日はタイムセールの日で、店 i で買い物をすると a_i 円の割引が受けられます。

ただし、ある店で買い物をすると、その後に続く D−1 軒の店では買い物ができません。つまり、店 i で買い物をしたら、次に買い物ができるのは店 i+D 以降です。

それぞれの店では高々 1 回しか買い物をしません。買い物をする店を上手に選んだときの、割引額の合計の最大値を求めてください。

## 制約

入力:

```
N D
a_1 a_2 … a_N
```

出力: 割引額の合計の最大値を 1 行に出力する（最後に改行を付ける）。

- 1 ≤ N ≤ 2×10^5
- 1 ≤ D ≤ 10^9
- 1 ≤ a_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
6 2
5 6 5 1 9 8
```

出力例 1:

```
19
```

店 1・3・5 で買うと 5 + 5 + 9 = 19 です。いちばん割引の大きい店 5 と次に大きい店 2 を選ぶと 15 にしかなりません。

入力例 2:

```
3 5
2 9 4
```

出力例 2:

```
9
```

入力例 3:

```
4 1
1000000000 1000000000 1000000000 1000000000
```

出力例 3:

```
4000000000
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「D = 1 のときは？」→ 制限なし。全部の店で買える（入力例 3）。
  - 「D が N より大きいときは？」→ 1 店でしか買えない（入力例 2）。
  - 「前の店に戻ってもいい？」→ 店は番号順に並んでいるだけで、選ぶ店の集合が「どの 2 店も番号の差が D 以上」になればよい。
  - 「どこでも買わないのは？」→ 認めるが、a_i ≥ 1 なので 1 店は必ず買った方が得。
- ヒントの出し順:
  1. 「大きい順に取る方法の反例を、3 店で作れますか」（5 6 5、D = 2）
  2. 「店 i まで見たときの最大を dp[i] とすると、店 i で買う場合と買わない場合はそれぞれ何になりますか」
  3. 「店 i で買うとき、その前の買い物はどこまでの店なら許されますか」（店 i−D 以前。dp[i−D] にまとめて入っている）
- 再帰で「買う/買わない」を全部試す方法を書き始めたら、N = 2×10^5 での回数（2^N）と再帰の深さを聞く。

## 振り返り用解説（終了後のみ表示）

**想定解答**: `dp[i]` を「店 1〜i だけを使ったときの割引の最大」とし、`dp[0] = 0` とします。店 i について、

- 買わない: `dp[i−1]`
- 買う: 直前の買い物は店 i−D 以前なので `dp[i−D] + a_i`（i−D < 0 なら `a_i`）

の大きい方が `dp[i]` です。`dp[i−D]` は「店 i−D までで最大」なので、「直前に買った店」を全部試す必要がありません。答えは `dp[N]`。時間 O(N)、空間 O(N)。

**素朴解が落ちる理由**:
- 割引の大きい順に、ぶつからない店を取る貪欲は最適になりません（入力例 1、hidden-trap-greedy）。
- 「最後に買う店 i」と「その前に買った店 j ≤ i−D」の組を全部試す DP は O(N^2) で、D = 1 のとき約 2×10^10 回になり TLE（hidden-max-d1）。
- 買う・買わないの全探索は 2^N 通りで、再帰で書くと深さも 2×10^5 になります（Python は既定の再帰上限 1000 で RecursionError）。

**別解**: `best[i]` =「店 i で最後に買うときの最大」とし、`best[i] = a_i + max(best[0..i−D])` の max を累積最大（prefix max）で持ち回しても O(N) です。

**言語別の注意**:
- C/Go/Rust: 合計は `long long` / `int64` / `i64`（2×10^14）。C は `dp` を `static long long dp[200001]`。`i − D` は D ≤ 10^9 なので int で計算してよいが、負の添字にしない。
- TypeScript: 2×10^14 は 2^53 未満なので `number` で正確。`Float64Array(N+1)` を使うと速い。
- PHP: 整数は 64bit。2×10^5 個の分割は `explode(' ', ...)`。
- Python: `dp[i − D]` は i−D が負だと末尾の要素を読んでしまう（エラーにならない）ので、必ず `i − D >= 0` を確かめる。
