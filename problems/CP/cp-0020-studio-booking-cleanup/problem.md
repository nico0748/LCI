---
id: cp-0020
slug: studio-booking-cleanup
title: "片付け時間つきスタジオ予約"
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
    text: "開始の早い順に受けていく方法に、うまくいかない例はありますか"
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
    text: "N ≤ 10^5 なので、予約の組合せを全部試す 2^N や O(N²) の DP（約 5×10^9）は不可。ソート 1 回の O(N log N) の貪欲を目指すと宣言する"
    weight: 3
  - id: tp2
    text: "開始の早い順・長さの短い順の貪欲には反例がある（最初に長い予約を取る、2 件にまたがる短い予約を取る）。反例を 1 つ挙げてから方針を決める"
    weight: 2
  - id: tp3
    text: "終了時刻の早い順に見て、「次に始められる最も早い時刻 free = 直前に受けた予約の終了 + C」以降に始まる予約を受ける。早く終わる予約を取るほど後ろに残る選択肢が多い（交換して悪くならない）"
    weight: 3
  - id: tp4
    text: "エッジケース: ちょうど「終了 + C」に始まる予約は受けられる（>= で比べる）・C = 0 で連続した予約・終了 + C は最大 3×10^9 で 32bit を超える・N = 1"
    weight: 1
  - id: tp5
    text: "入力は 10^5 行（約 2MB）なのでまとめて読む。サンプル以外に「長い予約 1 件と、その中の短い予約がたくさん」の反例を自作して試す"
    weight: 1
requirements:
  - id: max_count
    label: "受けられる予約の最大件数を出力する"
  - id: boundary
    label: "次の開始がちょうど「前の終了 + C」の予約を受けられる（C = 0 なら終わった時刻ちょうどに次を始められる）"
  - id: int64
    label: "終了 + C を 64bit で計算する（最大 3×10^9）"
  - id: fast
    label: "N = 10^5 で制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-start-order・hidden-trap-shortest-first・hidden-trap-equal-boundary・hidden-trap-int32-sum が通れば合格"
  explanation: "終了の早い順が最適な理由（交換論法: 最適解の最初の予約を、最も早く終わる予約に置き換えても悪くならない）を説明できれば加点"
  time_management: "10 分で終了順の貪欲と宣言（反例も 1 つ）、20 分でサンプル 2 件が通る、残りで等号・C = 0・大きい C を試す"
  red_flags:
    - "開始時刻の早い順に貪欲に受け、長い予約に塞がれる"
    - "s > e + C と等号を入れずに比べ、ちょうどに始まる予約を断る"
    - "終了 + C を 32bit の int で計算し、C が大きいと負になって重なる予約まで受ける"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 区間スケジューリング（終了時刻順の貪欲） / 題材: 片付け時間が必要な音楽スタジオの予約）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 区間スケジューリング（終了時刻順の貪欲）の定番。予約の間に片付け時間 C を挟む点が独自"
    - "§5 の制約（時刻 ≤ 10^9）のまま C ≤ 10^9 にすると終了 + C ≤ 2×10^9 で int32 に収まり、罠「終了 + C は int32 を超える」が成立しない。そのため C の上限を 2×10^9 にした（C 自体は int32 に収まる）。終了 + C が 2^31 − 1 を超えるときはその後に始まる予約が無いので、int32 で溢れた実装だけが重なる予約を受けて件数が増える（hidden-trap-int32-sum*）"
---

## 問題文

音楽スタジオに N 件の予約希望が届きました。予約 i は時刻 s_i に始まり、時刻 e_i に終わります。スタジオは 1 部屋だけなので、受けた予約どうしが重なってはいけません。さらに、予約が終わるたびに片付けの時間が C 分必要で、次の予約は前の予約の終了時刻から C 分以上たってから始めなければなりません。

つまり、受けた予約を開始時刻の順に並べたとき、隣り合うどの 2 件 a, b（a が先）も s_b ≥ e_a + C を満たす必要があります。ちょうど s_b = e_a + C に始まるのはかまいません。

受けられる予約の件数の最大値を答えてください。

## 制約

入力:

```
N C
s_1 e_1
s_2 e_2
…
s_N e_N
```

出力: 受けられる予約の最大件数を 1 行。

- 1 ≤ N ≤ 10^5
- 0 ≤ C ≤ 2×10^9
- 0 ≤ s_i < e_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4 10
0 30
20 50
45 70
90 120
```

出力例 1:

```
3
```

0〜30 の予約を受けると、次は 40 以降に始まる予約だけを受けられます。45〜70 と 90〜120 も受けて 3 件です。

入力例 2:

```
3 0
10 20
20 30
15 25
```

出力例 2:

```
2
```

C = 0 なので、10〜20 の予約のあと、ちょうど 20 に始まる 20〜30 の予約を受けられます。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「最後の予約の後にも片付けは要りますか」→ 要るが、その後に予約が無いので答えには影響しない。
  - 「s_b = e_a + C ちょうどは？」→ 受けられる。
  - 「予約の一部だけ受けることは？」→ できない。丸ごと受けるか断るか。
  - 「C = 0 は？」→ ありうる。終わった時刻ちょうどに次を始めてよい。
  - 「まったく同じ時刻の予約が 2 件あったら？」→ ありうる。重なるのでどちらか 1 件だけ。
- 見るところ: 自分で反例を作って貪欲の基準を選べるか。交換論法での説明、等号と 64bit。
- ヒントの出し順:
  1. 「最初に受ける予約を 1 つ選ぶとしたら、どれを選ぶと後ろに一番多く残せますか」
  2. 「開始が一番早い予約がとても長かったら、開始順の貪欲はどうなりますか」
  3. 「終わるのが一番早い予約を最初に受けて、損をすることはありますか」

## 振り返り用解説（終了後のみ表示）

**想定解**: 予約を終了時刻の昇順にソートし、`free = 0`（次に始めてよい最も早い時刻。最初は制約なし）から始めます。順に見て `s ≥ free` なら受けて件数を 1 増やし、`free = e + C` にします。時間 O(N log N)。

**正しさ（交換論法）**: 最適解のうち最も早く終わる予約 x を、全体で最も早く終わる予約 y に置き換えます。y の終了 ≤ x の終了なので、x の次に受けていた予約 z について s_z ≥ e_x + C ≥ e_y + C が成り立ち、置き換えても条件を満たしたまま件数は変わりません。残りの予約（free 以降に始まるもの）に同じ議論を繰り返すと、貪欲の結果が最適解と同じ件数になります。

**素朴解が落ちる理由**:
- 開始の早い順: 最初に長い予約（0〜1000）を取ると、その間の短い予約をすべて失う（hidden-trap-start-order、hidden-max-chain-under-long）。
- 長さの短い順: 2 件の間にまたがる短い予約（45〜60）を取ると、両側の 2 件を失う（hidden-trap-shortest-first）。
- 全探索 2^N や、dp[i] = 予約 i を最後に受けたときの最大件数 を全ペアで更新する O(N²) は、N = 10^5 で約 5×10^9 回になり TLE。

**別解**: 各予約を [s, e + C) に伸ばすと、「伸ばした区間が重ならないように最大個数を選ぶ」普通の区間スケジューリングになります（e + C の順は e の順と同じ）。重み付きにしたい場合は、終了順に並べて dp[i] = max(dp[i−1], dp[j] + 1)（j は e_j + C ≤ s_i を満たす最後の予約、二分探索）で O(N log N)。

**言語別の注意**:
- C: s, e は `int` で読めるが、`e + C` は `long long` で計算する（C も `long long` で読む）。`qsort` の比較関数は引き算ではなく `(a > b) - (a < b)` で書くと安全。
- Go: `int` は 64bit（amd64）。`sort.Slice` で終了順。
- Rust: `i64` で読む。`sort_unstable_by_key(|x| x.1)`。
- TypeScript: 3×10^9 は Number で正確（2^53 未満）。`| 0` などのビット演算を使うと 32bit に切られる。`sort` には必ず数値の比較関数 `(a, b) => a[1] - b[1]` を渡す（既定は文字列順）。
- PHP: `int` は 64bit。`usort` で終了順。
- Python: `sorted(zip(ends, starts))` でタプルのソート。溢れの心配は無い。
