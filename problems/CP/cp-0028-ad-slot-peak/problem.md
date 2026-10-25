---
id: cp-0028
slug: ad-slot-peak
title: "広告枠の最大同時掲載額"
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
    text: "時刻が 10^9 まであると、時刻ごとの配列は作れますか"
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
    text: "N ≤ 10^5、時刻 ≤ 10^9 なので、時刻ごとの配列（10^9 要素）は MLE。変化が起きる 2N 個の時刻だけを整列して O(N log N) にすると宣言する"
    weight: 3
  - id: tp2
    text: "候補の時刻（開始時刻）ごとに全広告を見て足す素朴解は O(N^2) = 10^10 回で TLE。時刻を 1 ずつ見る方法は 10^9 回でさらに無理と言う"
    weight: 2
  - id: tp3
    text: "広告 i を (s_i, +c_i) と (t_i, −c_i) の 2 つのイベントにして時刻順に足していく。同じ時刻の終了と開始は、終了を先に処理する（または増減を時刻ごとにまとめてから合計を見る）"
    weight: 3
  - id: tp4
    text: "合計は最大 10^5 × 10^9 = 10^14 で 64bit が必要。同じ最大値が離れて何度も出たら最初の時刻、N = 1、開始がすべて同じ時刻を確かめる"
    weight: 1
  - id: tp5
    text: "出力は「最大値 時刻」の 1 行。サンプル 1 の時刻 5（終了と開始が重なる）を手で追い、鎖状に接する広告を自作して山が 2 本分にならないか試す"
    weight: 1
requirements:
  - id: correct_output
    label: "F(x) の最大値と、それを達成する最小の整数時刻 x を空白区切りで 1 行に出力する"
  - id: end_before_start
    label: "時刻 t_i ちょうどには広告 i を数えない（同じ時刻に終わる広告と始まる広告を同時に数えない）"
  - id: int64
    label: "合計が 2^31 を超えても正しく扱う（最大 10^14）"
  - id: within_limit
    label: "N = 10^5、時刻が 10^9 まで散らばる入力でも、時間とメモリの制限内に終わる"
rubric_hints:
  correctness: "hidden-trap-end-before-start（同時刻の順序）・hidden-trap-int64・hidden-trap-earliest-peak が WA の主因。hidden-max-* は O(N^2) の素朴解を TLE にし、hidden-trap-huge-times は配列のいもす法を MLE にする"
  explanation: "イベントの整列（座標圧縮）と O(N log N) を言い、時刻ごとの配列や O(N^2) と比べられれば加点。同時刻の処理順の理由を説明できるとよい"
  time_management: "8 分以内にイベントの整列と同時刻の順序を宣言、18 分以内にサンプル 3 件が通る、残りで接する区間と 64bit を試す"
  red_flags:
    - "時刻の最大値まで配列を取るいもす法を書き、10^9 要素でメモリ不足になる"
    - "イベントを時刻だけで並べ、同じ時刻の開始を終了より先に足して山を高く数える"
    - "合計を int（32bit）で持ち、10^9 円の広告が 3 本重なると溢れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: イベントソート・座標圧縮（いもす法の疎版）/ 題材: 駅のデジタルサイネージの広告枠。単価の同時合計の最大と最初の時刻）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "cp-0022（入退場ログ）と同じ作者のいもす系。0022 は時刻が 86400 までで配列が持てる・人数を数える・総秒数も問う。0028 は時刻が 10^9 までで整列が必須・単価の和・最初の時刻だけを問う"
---

## 問題文

ある駅のデジタルサイネージには広告枠があり、N 件の広告が登録されています。広告 i は時刻 s_i から掲載が始まり、時刻 t_i に終わります。つまり、s_i 以上 t_i 未満の時刻に掲載されています。広告 i の単価は c_i 円です。

時刻 x に掲載中の広告の単価の合計を F(x) とします。整数の時刻 x の中で F(x) が最大になるときの値と、F(x) がその値になる最も早い時刻 x を求めてください。

## 制約

入力:

```
N
s_1 t_1 c_1
s_2 t_2 c_2
…
s_N t_N c_N
```

出力: F(x) の最大値と、それを達成する最小の時刻 x を、空白区切りで 1 行に出力する（最後に改行を付ける）。

- 1 ≤ N ≤ 10^5
- 0 ≤ s_i < t_i ≤ 10^9
- 1 ≤ c_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3
1 5 100
3 8 200
5 9 50
```

出力例 1:

```
300 3
```

時刻 5 には広告 1 はもう掲載されていないので、F(5) = 200 + 50 = 250 です。

入力例 2:

```
2
0 1000000000 1000000000
999999999 1000000000 1000000000
```

出力例 2:

```
2000000000 999999999
```

入力例 3:

```
3
30 40 3
35 50 2
10 20 5
```

出力例 3:

```
5 10
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「t_i ちょうどには掲載されている？」→ されていない（s_i 以上 t_i 未満）。入力例 1 の時刻 5 で確かめられる。
  - 「最大になる時刻が何回もあったら？」→ 最も早い時刻（入力例 3: 10 と 35 が同じ 5）。
  - 「時刻は整数だけ考えればよい？」→ そう。端点が整数なので、F は端点の間で一定。
  - 「単価の合計の大きさは？」→ 最大 10^14。32bit では足りない。
- ヒントの出し順:
  1. 「F(x) の値が変わるのは、どんな時刻ですか」（どれかの s_i か t_i だけ）
  2. 「その時刻を全部並べて、左から増減を足していくと何が分かりますか」（各区間の F。イベントソート）
  3. 「同じ時刻に終わる広告と始まる広告があるとき、どちらを先に足しますか」（終了。あるいは時刻ごとに増減をまとめてから最大を見る）
- cp-0022 を解いた人は配列のいもす法をそのまま書きがち。followup で 10^9 要素の配列を作れるか聞く。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 広告 i ごとに (s_i, +c_i) と (t_i, −c_i) の 2 つのイベントを作り、時刻の昇順に並べます。同じ時刻は −（終了）を先にします。前から順に増減を足しながら、合計がそれまでの最大を**超えたとき**だけ（最大値, 時刻）を更新すると、同じ最大値が後でまた出ても最初の時刻が残ります。同じ時刻のイベントを辞書（map）で 1 つにまとめてから並べても同じ結果になります。時間 O(N log N)、空間 O(N)。

**素朴解が落ちる理由**: 時刻ごとの配列（いもす法）は 10^9 + 1 要素で、int でも 4GB になりメモリ制限（256MB）を超えます（hidden-trap-huge-times）。最大になりうる時刻を開始時刻 N 個に絞っても、各時刻で全広告を調べると N^2 = 10^10 回で TLE です（hidden-max-random / hidden-max-nested）。

**別解**: 時刻を座標圧縮（端点を整列して重複を除き、番号を振る）して長さ 2N の配列でいもす法を行う方法も同じ O(N log N) です。

**言語別の注意**:
- C: イベントは構造体配列にして `qsort`。比較関数は時刻を `a < b ? -1 : a > b`（引き算は 10^9 どうしで溢れうるので避ける）、同時刻は増減の小さい方（負）を先。合計は `long long`。
- Go/Rust: 合計は `int64` / `i64`。Go は `sort.Slice`、Rust は `sort_unstable_by_key(|&(t, d)| (t, d))`（d が負の終了が先に来る）。
- TypeScript: 10^14 は 2^53 未満なので `number` で正確に扱える。`sort` には必ず比較関数を渡す（無いと文字列順）。
- PHP: 整数は 64bit。`usort` よりも、時刻をキーにした連想配列に増減を足して `ksort` する方が速い。
- Python: 辞書に増減をまとめて `sorted` するのが簡単で速い。
