---
id: cp-0003
slug: bookshelf-min-width
title: "本棚 K 段の最小の棚幅"
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
    text: "この制約だと、棚幅を 1 ずつ試す方法は間に合いますか"
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
    text: "N = 2×10^5、w_i ≤ 10^9 なので答えは最大 Σw = 2×10^14。幅を 1 ずつ試すのは論外で、O(N log Σw) ≒ 2×10^5 × 48 ≒ 10^7 回に収める"
    weight: 3
  - id: tp2
    text: "素朴解: 棚幅を max(w) から 1 ずつ増やして判定すると最大 10^14 回試す。どこで区切るかの区間 DP も O(N^2 K) で間に合わない"
    weight: 2
  - id: tp3
    text: "観察: 棚幅 W で K 段に収まるなら W + 1 でも収まる（単調性）ので「K 段に収まる最小の W」を答えで二分探索できる。判定は左から入るだけ詰める貪欲で O(N)"
    weight: 3
  - id: tp4
    text: "エッジ: K ≥ N（答えは max(w)）、K = 1（答えは Σw）、1 冊だけ候補の幅より厚い（下限を max(w) にする）、Σw が int32 を超える"
    weight: 1
  - id: tp5
    text: "N K と w の列を一括で読む。自作入力として w = 1 1 1 100 1 1、K = 3（答え 100）を作り、判定関数の下限と境界を確かめる"
    weight: 1
requirements:
  - id: min_max_width
    label: "最も広い段の棚幅の最小値を出力する"
  - id: edge_k
    label: "K ≥ N のとき max(w)、K = 1 のとき Σw を正しく出力する"
  - id: wide_book
    label: "1 冊だけ極端に厚い本があっても正しい（どの段にも入らない棚幅を可としない）"
  - id: within_limit
    label: "N = 2×10^5、答えが 10^14 規模でも制限時間内に終わり、合計を 64bit で正しく扱う"
rubric_hints:
  correctness: "hidden-max-k2 / hidden-max-all-equal（TLE）、hidden-trap-wide-book*（下限）、hidden-trap-k-ge-n、hidden-trap-overflow*（64bit）が通れば合格"
  explanation: "「幅 W で収まるなら W より広くても収まる」という単調性を言葉にしてから二分探索を選び、判定の貪欲が最適な理由（できるだけ詰めて損はない）を説明できれば加点"
  time_management: "8 分で単調性と二分探索の方針を宣言し、18 分でサンプル 3 件が通り、残りで K ≥ N と厚い 1 冊のケースを試す"
  red_flags:
    - "答えの棚幅を 1 ずつ増やして試す（hidden-max-k2 で TLE）"
    - "二分探索の下限を 0 や 1 にしたうえで、判定で「1 冊が棚幅より厚い」場合を不可にしない"
    - "厚さの合計を int（32bit）で持つ"
    - "lo / hi の更新（hi = mid、lo = mid + 1）と終了条件がずれて、無限ループや 1 ずれになる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 答えで二分探索＋貪欲判定 / 題材: 図書室の本を順番どおり K 段の本棚に入れる）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 「配列を K 個以下の連続区間に分け、区間和の最大を最小化する」定番問題（painter's partition 型）。題材・入出力・空の段を許す扱いは独自"
---

## 問題文

図書室の本を本棚に入れます。N 冊の本が左から順に並んでいて、i 冊目の厚さは w_i です。本の順番を変えずに、本棚の K 段へ先頭から順に分けて入れます（左から何冊かを 1 段目、続く何冊かを 2 段目、…とする。1 冊も入れない段があってもかまいません）。

ある段に入れた本の厚さの合計を、その段に必要な棚幅とします。本棚はすべての段が同じ幅なので、各段に必要な棚幅の最大値をできるだけ小さくしたいです。その最小値を求めてください。

## 制約

入力:

```
N K
w_1 w_2 … w_N
```

出力: 各段に必要な棚幅の最大値の、最小値を 1 行に出力してください。

- 1 ≤ N ≤ 2×10^5
- 1 ≤ K ≤ 2×10^5
- 1 ≤ w_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 2
3 1 4 1 5
```

出力例 1:

```
8
```

`3 1 4` と `1 5` に分けると、必要な棚幅は 8 と 6 で、最大は 8 です。これより小さくはできません。

入力例 2:

```
3 5
2 7 1
```

出力例 2:

```
7
```

段が本より多いので 1 段に 1 冊ずつ入れられます。最も厚い 7 の本がある段が最大です。

入力例 3:

```
8 3
5 2 7 3 6 1 4 8
```

出力例 3:

```
14
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「本の順番を入れ替えてもいいですか」→ いいえ。先頭から順に区切るだけです。
  - 「K 段を全部使わないといけませんか」→ いいえ。空の段があってもよいので、K 段**以下**に分ければよいです。
  - 「K が N より大きいことはありますか」→ あります（答えは最も厚い本の厚さ）。
- 見たいこと: 答えの大きさ（最大 2×10^14）から、幅を 1 ずつ試せないと見積もるか。単調性を言葉にしてから二分探索に入るか。
- ヒントの出し順:
  1. 「棚幅を 1 つ決め打ちしたら、K 段に収まるかどうかは簡単に判定できますか」
  2. 「幅 W で収まるなら、W + 1 ではどうですか。探す範囲の下限と上限はいくつですか」
  3. 「1 冊だけ厚い本（1 1 1 100 1 1、K = 3）で、判定関数は何を返しますか」
- cp-0010（最寄り駅）も二分探索の問題だが、あちらは「ソート済みの配列の中で位置を探す」型。こちらは「答えの値そのものを探す」型である点を区別して説明できるかも見る。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 「棚幅 W なら K 段以内に収まるか」を判定する関数 fits(W) を作ります。左から本を見て、今の段に入れると W を超えるときだけ次の段へ移る貪欲で、使った段数が K 以下なら可です。W が大きいほど段数は増えないので fits は単調です。そこで lo = max(w)（どの本も 1 段に入る最小の幅）、hi = Σw（全部を 1 段）から二分探索し、fits(mid) なら hi = mid、そうでなければ lo = mid + 1 とします。時間 O(N log Σw)（約 2×10^5 × 48）、空間 O(N)。

**貪欲が最適な理由**: ある段に入れられる本を次の段へ回しても、後ろの段の負担が増えるだけで得はありません。だから「入るだけ詰める」が最少の段数を与えます。

**素朴解が落ちる理由**:
- 幅を max(w) から 1 ずつ増やすと、試す回数は「答え − max(w)」回です。hidden-max-k2 では約 5×10^13 回になり、C でも終わりません（gen/naive.py・gen/naive.c）。
- 区切り位置の DP は O(N^2 K) で、N = 2×10^5 では不可能です。
- 下限を 0 や 1 にしたうえで判定が「厚い 1 冊は新しい段に置く」だけだと、その段だけ W を超えたまま可と判定され、答えが max(w) より小さくなります（hidden-trap-wide-book）。

**別解**: 累積和を作り、判定で「今の段の開始位置から W 以内で届く最後の位置」を二分探索（bisect）で飛ぶと、1 回の判定が O(min(K, N) log N) になります。K が小さいときに速くなります。

**言語別の注意**:
- C: 合計と mid は `long long`。`(lo + hi) / 2` は 4×10^14 程度なので 64bit で溢れない。
- Go: `int` は 64bit なのでそのままでよい。入力は `bufio` で読む。
- Rust: `u64` / `i64` で持つ。`usize` も 64bit 環境では足りるが、意図を明示するなら `u64`。
- TypeScript: 2×10^14 は 2^53（約 9×10^15）より小さいので Number で正確に扱える。`Math.floor((lo + hi) / 2)` を忘れない。
- Python: 判定関数の中で `count > k` になった時点で打ち切ると、K が小さいときに速い。
