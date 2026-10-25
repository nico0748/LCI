---
id: cp-0022
slug: venue-peak-occupancy
title: "入退場ログの最大滞在人数"
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
    text: "N = 2×10^5 人がほぼ一日中いると、1 秒ずつ数える方法は間に合いますか"
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
    text: "N = 2×10^5、時刻は 0〜86400 秒なので、O(N + 86400) のいもす法なら 10^6 回未満で、Python でも十分間に合うと見積もる"
    weight: 3
  - id: tp2
    text: "素朴解（来場者ごとに滞在中の秒を 1 秒ずつ塗る）は O(N × 86400) = 最大 1.7×10^10 回で TLE になると言う"
    weight: 2
  - id: tp3
    text: "人数が変わるのは入場・退場の秒だけなので、diff[s] += 1・diff[t] −= 1 の累積和で全秒の人数 c(x) が出る。半開区間 [s, t) なので t 秒には数えない"
    weight: 3
  - id: tp4
    text: "退場 86400 は diff の添字 86400 になるので配列は 86401 要素。最大の時間帯が複数あれば総秒数は合計し、最初の秒は最小の x"
    weight: 1
  - id: tp5
    text: "2×10^5 行はまとめて読む。サンプル 1（20 秒の退場と入場）を手で追い、鎖状の区間 [0,10),[10,20),… を自作して 2 人にならないか確かめる"
    weight: 1
requirements:
  - id: correct_output
    label: "c(x) の最大値 P、c(x) = P となる最小の x、c(x) = P となる x の個数を、この順に 1 行ずつ出力する"
  - id: half_open
    label: "退場時刻 t_i ちょうどの秒にはその来場者を数えない（同じ秒の退場と入場を 2 人と数えない）"
  - id: closing_boundary
    label: "退場時刻が 86400 の来場者を範囲外アクセスなしに扱い、86399 秒を数え漏らさない"
  - id: within_limit
    label: "N = 2×10^5 人がほぼ一日中いる入力でも制限時間内に終わる"
rubric_hints:
  correctness: "hidden-trap-half-open-chain（閉区間の誤り）と hidden-trap-closing-86400（配列の大きさ）が WA/RE の主因。hidden-max-long-stay は秒を塗る素朴解を TLE にする"
  explanation: "差分配列（いもす法）の考え方と O(N + 86400) を言い、素朴解の 1.7×10^10 回と比べられれば加点。半開区間を自分の言葉で言い換えられるとよい"
  time_management: "8 分以内にいもす法と半開区間の扱いを宣言、18 分以内にサンプル 3 件が通る、残りで 86400 の境界と鎖状の区間を自作して試す"
  red_flags:
    - "計算量を見積もらずに、来場者ごとに滞在中の秒を 1 秒ずつ数える二重ループを書く"
    - "閉区間 [s, t] で数え、同じ秒の退場と入場を 2 人と数える"
    - "配列を 86400 要素で取り diff[86400] に書く（C は未定義動作、Go/Rust は panic、TS は NaN が広がる）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: いもす法（差分配列の累積和）/ 題材: 展示会場の入退場ゲートのログ。最大人数・最初の秒・その総秒数を問う）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "C の素朴解（秒を塗る）は gcc -O2 の自動ベクトル化で速くなりうるため、naive.c は同梱していない（TLE を確認しているのは naive.py）"
---

## 問題文

ある展示会場の入場ゲートは、来場者ごとに入場時刻と退場時刻を記録しています。時刻は開場からの経過秒数で、0 以上 86400 以下の整数です。

来場者 i は時刻 s_i に入場し、時刻 t_i に退場します。来場者 i が会場にいるのは、s_i 秒以上 t_i 秒未満の間です（t_i 秒ちょうどには、もう会場にいません）。

0 ≤ x ≤ 86399 の各整数 x について、x 秒に会場にいる人数を c(x) とします。次の 3 つを求めてください。

1. c(x) の最大値 P
2. c(x) = P となる x のうち最小のもの
3. c(x) = P となる x の個数（最大人数だった総秒数）

## 制約

入力:

```
N
s_1 t_1
s_2 t_2
…
s_N t_N
```

出力: P、最小の x、総秒数を、この順に 1 行に 1 つずつ出力する（最後に改行を付ける）。

- 1 ≤ N ≤ 2×10^5
- 0 ≤ s_i < t_i ≤ 86400
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4
10 20
15 30
20 25
40 41
```

出力例 1:

```
2
15
10
```

20 秒には来場者 1 はもういないので、15〜24 秒の 10 秒間が 2 人です。

入力例 2:

```
3
86000 86400
86399 86400
0 86400
```

出力例 2:

```
3
86399
1
```

入力例 3:

```
5
100 200
150 160
300 400
350 360
500 501
```

出力例 3:

```
2
150
20
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「t_i 秒ちょうどにはいる？」→ いない（半開区間）。入力例 1 の 20 秒が確認用。
  - 「86400 秒は数える？」→ x は 86399 まで。86400 は退場時刻としてだけ現れる。
  - 「同じ人が何回も来ることは？」→ 1 行が 1 回の入退場。同じ人かどうかは気にしなくてよい。
  - 「最大の時間帯が離れて 2 回あったら？」→ 総秒数は合計する。最初の秒は早い方（入力例 3）。
- ヒントの出し順:
  1. 「人数が変わるのはどの秒ですか」（入場した秒と退場した秒だけ）
  2. 「入場で +1、退場で −1 を書いた配列を、左から足していくと何になりますか」（各秒の人数 = いもす法）
  3. 「退場 86400 を書き込むには、配列は何要素必要ですか」（86401）
- 素朴解（秒を塗る）を書き始めたら、followup で 2×10^5 × 86400 の見積もりを促す。cp-0028（広告枠）も同じ作者のいもす系だが、こちらは時刻が 86400 までなので配列で持てる点が違う。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 長さ 86401 の配列 diff を 0 で用意し、来場者ごとに `diff[s] += 1`、`diff[t] -= 1` とします。0 秒から順に足し合わせると `c(x) = diff[0] + … + diff[x]` が x 秒の人数になります（来場者 i は s_i 秒から数えられ、t_i 秒で引かれるので、ちょうど [s_i, t_i) の間だけ数えられる）。あとは c(0)〜c(86399) を 1 回走査して、最大値・最初の位置・個数を求めます。時間 O(N + 86400)、空間 O(86400)。

**素朴解が落ちる理由**: 来場者ごとに `for x in s..t: cnt[x]++` とすると、ほぼ一日中いる人が 2×10^5 人のとき 2×10^5 × 約 85000 ≈ 1.7×10^10 回になり、hidden-max-long-stay で TLE します。

**別解**: 入場 (s, +1)・退場 (t, −1) のイベントを時刻順（同時刻は退場を先）に並べて走査する方法でも O(N log N) で解けます。時刻の範囲が 10^9 まで広がると配列が持てないのでこちらが必要になります（cp-0028 広告枠）。

**言語別の注意**:
- 全言語: 配列は 86401 要素。閉区間で数えると hidden-trap-half-open-chain が 2 になる。
- C: `int diff[86401]` は大域変数に置く（ローカルでも 350KB 程度で通常は問題ないが、習慣として）。入力 2×10^5 行は `scanf` でも間に合うが、`fread` でまとめて読むと速い。
- Go: `bufio.Reader` で読む（`fmt.Scan` は 2×10^5 行で遅い）。
- TypeScript: 範囲外の添字は例外にならず `undefined` になり、足し算で `NaN` が広がる。`Int32Array(86401)` を使うと初期値 0 で速い。
- Python: 累積は `itertools.accumulate`、最大と位置と個数は `max`・`list.index`・`list.count` で C 速度になる。
- PHP: `array_fill(0, 86401, 0)` で用意する。`explode` / `preg_split` でまとめて分割する。
