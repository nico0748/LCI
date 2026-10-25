---
id: cp-0032
slug: counter-assignment
title: "窓口の割り当て"
category: CP
tier: core
difficulty: L2
time_limit: 30
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [requirements_clarify, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "時刻を 1 分ずつ進めるやり方は、この制約で間に合いますか"
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
    text: N ≤ 2×10^4、M ≤ 10 なので、客ごとに M 個の窓口を全部見ても O(NM) = 2×10^5 回。ヒープを使わなくても十分速いと宣言する
    weight: 3
  - id: tp2
    text: 素朴解の「時刻を 1 分ずつ進めるシミュレーション」は、時刻が 10^9 を超え待ちが 2×10^13 分にもなるので不可能。窓口ごとの「空く時刻 free[k]」だけを持つ
    weight: 2
  - id: tp3
    text: 案内時刻 s = max(a_i, min free[k])、使う窓口は free[k] ≤ s を満たす最小の k。(free, 番号) のヒープで最も前に空いた窓口を選ぶと、空き窓口が複数あるときに WA
    weight: 3
  - id: tp4
    text: free[k] == a_i（到着ちょうどに空く）は空き扱い、同時刻の到着は入力順、M > N、待ち時間は最大約 2×10^13 で 64bit が必要、を列挙する
    weight: 1
  - id: tp5
    text: N 行の出力はまとめて書く。入力例 2（同時に空く窓口）を手で追い、空き窓口が 2 つ以上ある場面の入力を自作して試す
    weight: 1
requirements:
  - id: correct_output
    label: 各客について、案内された窓口の番号と待ち時間を入力順に N 行で出力する
  - id: rule_tie_break
    label: 案内時点で空いている窓口（ちょうど空いたものを含む）のうち番号最小を選び、同時刻の到着は入力順に案内する
  - id: wide_integers
    label: 時刻と待ち時間を 64bit 整数で扱い、2×10^13 程度の値でも正しく出力する
  - id: within_limit
    label: N=2×10^4、M=10 で制限時間内に終わる（時刻を 1 ずつ進めない）
rubric_hints:
  correctness: "hidden-trap-free-at-arrival（≤ と < の違い）、hidden-trap-idle-lowest（ヒープの選び方）、hidden-trap-int64 / hidden-max-int64（32bit の溢れ）が通れば合格"
  explanation: "s = max(到着, 最も早く空く時刻) という式に落とし、規則の 2 つの場合（空きあり / 全部ふさがり）が同じ式で書けることを説明できれば加点"
  time_management: "8 分で案内時刻と窓口の決め方を宣言し、18 分以内に入力例 1・2 が通る"
  red_flags:
    - "(空く時刻, 番号) の優先度付きキューから取り出し、空いている窓口が複数あるときに番号最小ではなく最も前に空いた窓口を選ぶ"
    - "空き判定を free[k] < a_i にして、到着ちょうどに空いた窓口を使わない"
    - "C / Go / Rust で時刻を 32bit（int / int32 / i32）で持ち、所要 10^9 の客が並ぶと溢れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 待ち行列のシミュレーション（窓口ごとの空き時刻） / 題材: 市役所の窓口）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 複数サーバの FIFO 待ち行列（銀行の窓口）は定番。『空いている窓口が複数なら番号最小』を明示し、ヒープの素直な実装が WA になるようにした"
---

## 問題文

市役所に窓口が M 個（1〜M 番）あり、N 人の客が来ます。客 i は時刻 a_i に到着し、窓口で d_i 分の手続きをします。

客は到着順（同時刻に着いた客は入力の順）に 1 列に並び、先頭の客から 1 人ずつ窓口へ案内されます。列の先頭の客は、空いている窓口があればすぐに、無ければいずれかの窓口が空いた時点で案内されます。案内されるときは、その時点で空いている窓口のうち番号が最も小さい窓口を使います。窓口は、手続きが終わった時刻ちょうどから空いているとみなします。

各客について、案内された窓口の番号と、待ち時間（案内された時刻 − 到着した時刻）を求めてください。

## 制約

入力:

```
N M
a_1 d_1
⋮
a_N d_N
```

出力: N 行。i 行目に、客 i が案内された窓口の番号と待ち時間を空白区切りで出力する（最後に改行を付ける）

- 1 ≤ N ≤ 2×10^4
- 1 ≤ M ≤ 10
- 0 ≤ a_1 ≤ a_2 ≤ … ≤ a_N ≤ 10^9
- 1 ≤ d_i ≤ 10^9
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 2
0 5
1 3
2 4
4 2
4 1
```

出力例 1:

```
1 0
2 0
2 2
1 1
1 3
```

入力例 2:

```
3 2
0 3
0 3
1 2
```

出力例 2:

```
1 0
2 0
1 2
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「到着した時刻ちょうどに窓口が空く場合は、すぐ使えますか」→ 使える（「終わった時刻ちょうどから空いている」）。
  - 「客が着いたとき空いている窓口が 2 つ以上あったら」→ 番号が最も小さい窓口。どちらが先に空いたかは関係ない。
  - 「後ろの客が先に案内されることはありますか」→ ない。列は 1 本で、先頭から順に案内する。
- 入力例 1 の流れ: 客 3 は時刻 2 に着くが窓口 1 は 5 まで、窓口 2 は 4 まで手続き中なので、4 に窓口 2 へ（待ち 2）。客 4・5 はどちらも時刻 4 に着き、入力の順に窓口 1（5 に空く）→ 窓口 1（7 に空く）へ。
- ヒントの出し順:
  1. 「時刻を 1 分ずつ進めると何回ループしますか。窓口ごとに何を覚えておけば足りますか」
  2. 「客が案内される時刻を、到着時刻と各窓口の空く時刻で式にしてみてください」
  3. 「その時刻に空いている窓口が 2 つあったら、規則ではどちらを使いますか。ヒープの先頭はどちらになりますか」
- 64bit: 窓口 1 つに所要 10^9 分の客が 2×10^4 人並ぶと、最後の客の待ち時間は約 2×10^13（hidden-max-int64）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 窓口 k の「空く時刻」free[k] を配列で持ちます（最初は 0）。客を入力順に処理し、案内時刻を `s = max(a_i, min_k free[k])` とします。規則の 2 つの場合（到着時に空きがある / 全部ふさがっている）は、この 1 つの式にまとまります。使う窓口は `free[k] ≤ s` を満たす最小の k で、`free[k] = s + d_i`、待ち時間は `s − a_i` です。客ごとに M 個を見るので O(NM) = 2×10^5 です。a_i が単調非減少なので s も単調非減少になり、列の順序（FIFO）とも矛盾しません。

**素朴解が落ちる理由**: 時刻を 1 分ずつ進めるシミュレーションは、時刻が 10^9、待ちが 2×10^13 分にもなるので終わりません。また、(空く時刻, 番号) の優先度付きキューで先頭を取り出す実装は、「全部ふさがっているとき」には正しいですが、空いている窓口が複数あるときに「最も前に空いた窓口」を選んでしまい、番号最小の規則に反します（hidden-trap-idle-lowest）。空き判定を `free[k] < a_i` にすると、到着ちょうどに空いた窓口を見逃して番号の大きい窓口へ回します（hidden-trap-free-at-arrival）。

**別解**: M が大きい場合は、ヒープを 2 つ（手続き中の窓口を空く時刻順に、空いている窓口を番号順に）持ち、客ごとに「s までに空く窓口を手続き中のヒープから空きのヒープへ移してから、空きのヒープの最小番号を取る」とすれば O(N log M) です。

**言語別の注意**:
- C / Go / Rust: free[k] と s、待ち時間は 64bit（`long long` / `int64` / `i64`）。最大で約 2×10^13 になる。
- TypeScript: 2×10^13 は 2^53 より小さいので Number のままで正確に扱える。出力は配列に溜めて `join("\n")` で 1 回だけ書く。
- Python / PHP: N 行の出力をまとめて書く（print を 2×10^4 回でも間に合うが、癖にしておく）。
