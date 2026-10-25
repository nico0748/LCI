---
id: cp-0027
slug: commuter-pass-expiry
title: "定期券の有効期限"
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
    text: "1 月 31 日に開始した 1 か月の定期券と、2 月 29 日に開始した 12 か月の定期券は、それぞれいつまでですか"
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
    text: "Q ≤ 5×10^4 で 1 件 O(1) の計算にすれば十分。1 日ずつ進めると k = 1200 か月で約 3.6×10^4 日 × 5×10^4 件 = 1.8×10^9 回になるので避けると宣言する"
    weight: 3
  - id: tp2
    text: "言語の日付ライブラリ（JS の Date など）に任せると、存在しない日（4/31 → 5/1）へ黙って繰り上がる。規則どおり自分で月末を判定する方が安全だと比較する"
    weight: 2
  - id: tp3
    text: "月を 年×12 + (月−1) の通し番号にして k を足し、12 で割って年と月に戻す。その月の日数 days_in(年, 月) と開始日を比べ、無ければ月末・あれば前日"
    weight: 3
  - id: tp4
    text: "うるう年は 4 の倍数、ただし 100 の倍数で 400 の倍数でない年（1900・2100・2200・2300）は平年。開始日が 1 日だと前日は前の月の末日（1 月なら前年の 12/31）"
    weight: 1
  - id: tp5
    text: "出力は YYYY/MM/DD で月と日を 2 桁に 0 埋めする。サンプル 3（3/31 → 4/30、3/30 → 4/29）と 2/29 開始の 12 か月を自作して確かめる"
    weight: 1
requirements:
  - id: correct_output
    label: "各定期券について、規則どおりの有効期限を YYYY/MM/DD（月と日は 2 桁に 0 埋め）で 1 行ずつ出力する"
  - id: month_end
    label: "k か月後の月に開始日と同じ日が無いときは、その月の末日を答える（JS の Date のように翌月へ繰り上げない）"
  - id: leap_year
    label: "うるう年を 4・100・400 の規則で判定する（1900・2100 は平年、2000・2400 はうるう年）"
  - id: carry
    label: "月の繰り上がりで年が変わる場合と、1 日開始で前の月（前の年）の末日になる場合を正しく扱う"
rubric_hints:
  correctness: "hidden-trap-js-date-rollover（存在しない日の繰り上げ）・hidden-trap-century-leap（100/400 の規則）・hidden-trap-first-day（1 日の前日）・hidden-trap-year-carry が通れば合格ライン"
  explanation: "月の通し番号で k を足す考え方と、「同じ日が無い」「1 日開始」の 2 つの場合分けを説明できれば加点。日付ライブラリに任せたときの落とし穴に触れられるとよい"
  time_management: "8 分以内に月の通し番号と 3 つの場合分け（月末・前日・前の月の末日）を宣言、20 分以内にサンプル 3 件が通る、残りで 2/29 と世紀年を試す"
  red_flags:
    - "JS の Date（new Date(y, m − 1 + k, d)）で月を進めてから 1 日戻し、1/30 開始の 1 か月を 3/1 などと答える"
    - "うるう年を「4 で割り切れる」だけで判定し、2100/02/29 を出す"
    - "月に k を足したあと 12 を超えた分の年の繰り上げを忘れる（13 月や 0 月を出す）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 日付計算・うるう年・月の通し番号 / 題材: 鉄道の定期券。応当日の前日、応当日が無ければ月末まで有効）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

ある鉄道会社の定期券は、開始日から k か月間使えます。最後に使える日（有効期限）は、次のように決まります。

- 開始日の k か月後の月に、開始日と同じ日付の日があるとき: その日の前日
- その月に同じ日付の日が無いとき（例: 31 日に開始して、k か月後の月が 30 日まで）: その月の末日

例えば 2025/04/01 開始の 1 か月なら 2025/04/30、2025/01/31 開始の 1 か月なら 2025/02/28 です。

Q 件の定期券について、有効期限を求めてください。うるう年は西暦が 4 で割り切れる年です。ただし、100 で割り切れて 400 で割り切れない年はうるう年ではありません。

## 制約

入力:

```
Q
Y_1/M_1/D_1 k_1
Y_2/M_2/D_2 k_2
…
Y_Q/M_Q/D_Q k_Q
```

開始日は年が 4 桁、月と日が 2 桁（0 埋め）で与えられます。

出力: Q 行。i 行目に i 件目の有効期限を、開始日と同じ形式（YYYY/MM/DD、月と日は 2 桁に 0 埋め）で出力する（最後に改行を付ける）。

- 1 ≤ Q ≤ 5×10^4
- 開始日は 1900/01/01 から 2300/12/31 までの実在する日付
- 1 ≤ k_i ≤ 1200
- 年・月・日・k_i は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
4
2025/04/01 1
2025/01/31 1
2024/01/30 1
2025/12/15 1
```

出力例 1:

```
2025/04/30
2025/02/28
2024/02/29
2026/01/14
```

入力例 2:

```
3
2100/01/29 1
2000/01/29 1
2099/03/01 12
```

出力例 2:

```
2100/02/28
2000/02/28
2100/02/28
```

2100 年は平年なので 2 月 29 日がありません。2000 年はうるう年なので 2 月 29 日があり、その前日です。

入力例 3:

```
2
2023/03/31 1
2023/03/30 1
```

出力例 3:

```
2023/04/30
2023/04/29
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「前日が前の月にかかるときは？」→ 1 日開始なら前の月の末日（入力例 1 の 1 件目、入力例 2 の 3 件目）。
  - 「k か月後の月に同じ日が無いときは前日ではなく末日？」→ 末日そのもの（入力例 3: 3/31 → 4/30、3/30 → 4/29）。
  - 「日付ライブラリを使ってよい？」→ 使ってよいが、存在しない日の扱い（繰り上げ）が規則と違う言語が多い。
  - 「2400 年は？」→ 400 で割り切れるのでうるう年。2300/03/01 開始の 1200 か月が 2400/02/29 になる。
- ヒントの出し順:
  1. 「k か月後の年と月は、月を通し番号にするとどう計算できますか」（年×12 + 月−1 + k を 12 で割る）
  2. 「その月に開始日と同じ日があるかは、何と比べれば分かりますか」（その月の日数。2 月はうるう年の判定）
  3. 「同じ日の前日が前の月になるのは、開始日が何日のときですか」（1 日。前の月の日数が要る）
- JS の Date を使う人には、`new Date(2023, 1, 30)` が何日になるかを聞くと気づける。

## 振り返り用解説（終了後のみ表示）

**想定解答**: `idx = 年×12 + (月−1) + k` とし、`年' = idx ÷ 12`（切り捨て）、`月' = idx mod 12 + 1` で k か月後の年と月を出します。`L = days_in(年', 月')`（2 月は 4・100・400 の規則でうるう年なら 29）として、

1. 開始日 D > L なら、有効期限は 年'/月'/L（その月の末日）
2. 2 ≤ D ≤ L なら、年'/月'/(D−1)（同じ日の前日）
3. D = 1 なら、その前の月（月' = 1 なら前年の 12 月）の末日

です。1 件 O(1)、全体 O(Q)。

**素朴解との比較**: 1 日ずつ数えて進める方法は k = 1200 か月（約 36500 日）× 5×10^4 件 ≈ 1.8×10^9 回で、Python や PHP では間に合いません。1 か月ずつ進める方法（最大 1200 回 × 5×10^4 件 = 6×10^7 回）なら C/Go/Rust は間に合いますが、Python では際どくなります。通し番号なら 1 件 O(1) です。

**別解**: 日付ライブラリで「k か月後の 1 日」を作り、その月の日数を調べてから同じ規則を当てはめる方法でも正しく書けます。ただし Python の `datetime` は月の加算を持たず、JS の `Date` は存在しない日を翌月に繰り上げる（`new Date(2023, 1, 30)` は 3 月 2 日）ので、月の加算だけは自分で行う必要があります。

**言語別の注意**:
- TypeScript: `Date` で `setMonth(getMonth() + k)` すると 1/31 → 3/3 のように繰り上がり、1 日引いても 3/2 になる（hidden-trap-js-date-rollover）。さらにタイムゾーンで日がずれることもある。整数で計算する。0 埋めは `String(m).padStart(2, "0")`。
- C: `printf("%04d/%02d/%02d\n", y, m, d)`。入力は `scanf("%d/%d/%d %d", ...)` で読める。
- Go: `time.Date` は存在しない日を正規化（繰り上げ）するので同じ落とし穴がある。`fmt.Fprintf(w, "%04d/%02d/%02d\n", ...)`。
- Rust: 標準ライブラリに日付型は無いので整数で計算する。`format!("{:04}/{:02}/{:02}", ...)`。
- PHP: `strtotime("+1 month")` や `DateTime::modify` も 1/31 → 3/3 と繰り上がる。`sprintf("%04d/%02d/%02d", ...)`。
- Python: `divmod(idx, 12)` で年と月に戻す。5×10^4 行はまとめて読み、まとめて出力する。
