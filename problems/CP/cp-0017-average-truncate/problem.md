---
id: cp-0017
slug: average-truncate
title: "平均点の切り捨て表示"
category: CP
tier: core
difficulty: L1
time_limit: 15
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "平均が 66.66… のとき、1 行目には何と出しますか"
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
    text: "N ≤ 100、点数 ≤ 100 なので合計は 10^4 以下。計算量は問題にならず、丸め方と比較の正しさが主眼だと宣言する"
    weight: 3
  - id: tp2
    text: "printf の %.1f・round・toFixed(1) は四捨五入なので 66.66… を 66.7 にしてしまう。「小数第 2 位以下を切り捨て」は自分で作る必要がある"
    weight: 2
  - id: tp3
    text: "浮動小数を使わず整数で計算する: 表示は v = 合計×10 // N を「v // 10 . v % 10」に、比較は 点数×N ≥ 合計 に変形する。これなら誤差も四捨五入も起きない"
    weight: 3
  - id: tp4
    text: "エッジケース: 平均が整数（.0 を付ける）・平均ちょうどの人（以上なので含む）・平均 70.05 で表示 70.0 のときの 70 点の人（含まない）・N = 1・全員 0 点"
    weight: 1
  - id: tp5
    text: "1 行目は必ず小数第 1 位まで書く（JS の String(70) は \"70\"）。サンプル以外に 3 人で合計 200 点（66.6）の入力を試す"
    weight: 1
requirements:
  - id: truncated_avg
    label: "平均点を小数第 1 位まで切り捨てて、常に「整数部.1 桁」の形で出力する"
  - id: at_least_avg
    label: "切り捨てる前の正確な平均以上（等しい人を含む）の人の名前を入力順に出力する"
  - id: no_rounding
    label: "四捨五入や、表示用に切り捨てた値との比較による誤りが無い"
rubric_hints:
  correctness: "hidden-trap-round-up・hidden-trap-compare-displayed・hidden-trap-equal-and-format が通れば合格"
  explanation: "整数だけで計算する理由（四捨五入の関数と浮動小数を避ける）と、点数×N ≥ 合計 への変形を説明できれば加点"
  time_management: "3 分で「切り捨て」「以上」「入力順」を確認、8 分でサンプル 2 件が通る、残りで 66.6 と 70.05 のケースを試す"
  red_flags:
    - "printf(\"%.1f\") や round で平均を出し、四捨五入してしまう"
    - "表示用に切り捨てた平均と点数を比べ、平均よりわずかに低い人を含めてしまう"
    - "整数の割り算（合計 / N）で平均を出して小数部を失う"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 整数演算による切り捨て表示・比較の変形 / 題材: 小テストの集計）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "§5 の罠「浮動小数の誤差（sum×10//N で計算）」について: N ≤ 100・点数 ≤ 100 の全組合せを調べたところ、floor((合計/N)×10) が 合計×10//N とずれる例は無かった（倍精度・単精度とも）。誤差そのものはテストで突けないので、四捨五入（%.1f など）と表示値との比較を罠の中心にし、解説で整数計算を勧める"
---

## 問題文

小テストの結果を集計します。N 人の受験者の名前と点数が与えられるので、次の 2 つを出力してください。

1. 平均点を小数第 1 位まで表示したもの。小数第 2 位以下は**切り捨て**ます（四捨五入ではありません）。例えば平均が 71.66… なら `71.6` です。平均が整数のときも `70.0` のように小数第 1 位まで書きます。
2. 点数が平均点**以上**の受験者の名前を、入力された順に 1 行に 1 人ずつ。ここでの平均点は、切り捨てる前の正確な値です。

## 制約

入力:

```
N
s_1 p_1
s_2 p_2
…
s_N p_N
```

s_i は受験者の名前、p_i はその点数です。

出力: 1 行目に平均点（小数第 1 位まで、切り捨て）。2 行目以降に、平均点以上の受験者の名前を入力順に。

- 1 ≤ N ≤ 100、0 ≤ p_i ≤ 100（N, p_i は整数）
- s_i は英小文字からなる 1〜10 文字の文字列で、すべて異なる
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5
sato 60
suzuki 75
tanaka 80
ito 72
kato 65
```

出力例 1:

```
70.4
suzuki
tanaka
ito
```

合計 352 点で平均は 70.4 です。75 点・80 点・72 点の 3 人が平均以上です。

入力例 2:

```
4
mori 50
abe 70
ueda 90
noda 70
```

出力例 2:

```
70.0
abe
ueda
noda
```

平均はちょうど 70 なので `70.0` と書きます。70 点の 2 人も平均以上に入ります。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「平均以上の人が 0 人になることは？」→ 無い（最高点の人は必ず平均以上）。
  - 「2 行目以降は点数順ですか」→ 入力された順。
  - 「平均が 100 のときは？」→ `100.0`。
  - 「比べる平均は表示した値ですか」→ 切り捨てる前の正確な値。
- 見るところ: 「切り捨て」と言われて四捨五入の関数を避けられるか。割り算を掛け算に直して比べる発想。
- ヒントの出し順:
  1. 「66.66… を小数第 1 位で切り捨てると？ %.1f だと何が出ますか」
  2. 「割り算をせずに、平均の 10 倍の整数部分を出すには？」
  3. 「点数 ≥ 合計 / N を、割り算なしで書くと？」

## 振り返り用解説（終了後のみ表示）

**想定解**: 合計を S とし、`v = S × 10 // N` を計算します（0 以上なので整数の割り算がそのまま切り捨て）。1 行目は `v // 10` と `v % 10` を `.` でつないだもの。2 行目以降は `p × N ≥ S` を満たす人を入力順に出力します。浮動小数を一切使わないので、誤差も四捨五入も起きません。時間 O(N)。

**浮動小数で書く場合**: `avg = S / N` として、表示を `floor(avg × 10) / 10` で作ってから小数第 1 位で書く方法は、この制約（N ≤ 100、点数 ≤ 100）では全組合せで正しい値になります（gen で全数を確認済み）。落ちるのは次の 2 つです。
- `printf("%.1f", avg)`・`round(avg, 1)`・`avg.toFixed(1)` は四捨五入 → 66.66… が `66.7`、99.98 が `100.0` になる（hidden-trap-round-up・hidden-trap-round-up-to-100）。
- 表示用に切り捨てた値と比べる → 平均 70.05 のとき 70 点の人を入れてしまう（hidden-trap-compare-displayed）。整数の割り算 `S / N` と比べるのも同じ誤り（hidden-trap-compare-int-div）。

**別解**: Python の `fractions.Fraction(S, N)` で平均を分数のまま持ち、比較も分数で行う（gen/brute.py の方法）。`decimal` で `ROUND_DOWN` を指定して量子化してもよい。

**言語別の注意**:
- C: `printf("%d.%d\n", v / 10, v % 10)`。`(double)S / N` を `%.1f` で出すと四捨五入。
- TypeScript: `const v = Math.floor((S * 10) / N)` のあと `` `${Math.floor(v / 10)}.${v % 10}` ``。`String(70)` は `"70"` で小数点が付かない。
- Python: `f"{avg:.1f}"` も `round` も丸める（`round` は偶数丸め）。`//` と `%` で組み立てる。
- Go: `fmt.Sprintf("%.1f", ...)` は丸める。`fmt.Fprintf(w, "%d.%d\n", v/10, v%10)`。
- Rust: `format!("{:.1}", x)` も丸める。整数で組み立てる。
- PHP: `intdiv($s * 10, $n)` で切り捨て。`round`・`number_format`・`sprintf('%.1f')` はどれも丸める。
