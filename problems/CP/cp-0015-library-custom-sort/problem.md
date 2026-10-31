---
id: cp-0015
slug: library-custom-sort
title: "図書の並べ替え"
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
    text: "一覧に無いジャンルの本は、どの順番で並びますか"
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
    text: "N ≤ 3×10^4 なので O(N log N) のソート 1 回で十分。比較を 3 段（ジャンル → 年 → 書名）に分けて書くか、キーの組を作ってソートすると宣言する"
    weight: 3
  - id: tp2
    text: "比較関数を if の連鎖で書くと、等しいときに次のキーへ進む分岐を落としやすい。(ジャンルの順位, −年, 書名) のタプル（配列）をキーにすると辞書式の比較で 3 段が自動的にそろう"
    weight: 2
  - id: tp3
    text: "ジャンルの順位は map（ジャンル名 → 添字）で O(1) で引く。一覧に無いジャンルは順位 G にして、同じ G どうしはジャンル名で比べる。年は数値で比べる（文字列のままだと \"794\" > \"1200\"）"
    weight: 3
  - id: tp4
    text: "エッジケース: 一覧に無いジャンルが複数・一覧のジャンルが 1 冊も無い・同じジャンルと年の本・\"Book\" と \"Book2\" のような先頭一致・大文字と小文字の混在"
    weight: 1
  - id: tp5
    text: "TS の localeCompare は大文字小文字を辞書風に比べるので文字コード順にならない（a < b ? -1 : 1 で比べる）。PHP の <=> や sort は数字だけの書名を数値として比べるので strcmp を使う"
    weight: 1
requirements:
  - id: genre_order
    label: "一覧のジャンルを指定の順に、一覧に無いジャンルをその後ろにジャンル名の文字コード順で並べる"
  - id: year_desc
    label: "同じジャンルの中では出版年の新しい順（数値として比較）に並べる"
  - id: title_ascii
    label: "ジャンルと年が同じなら書名の文字コード順（大文字が小文字より前、先頭一致は短いほうが前）に並べる"
  - id: fast
    label: "N = 3×10^4 で制限時間内に出力する"
rubric_hints:
  correctness: "hidden-trap-ascii-case（大文字小文字）・hidden-trap-year-digits・hidden-trap-unlisted-order・hidden-trap-numeric-titles が通れば合格"
  explanation: "キーの設計（順位・年の符号反転・書名）と、文字コード順とロケールの辞書順の違いを説明できれば加点"
  time_management: "5 分でキーの優先順と一覧外ジャンルの扱いを確認、15 分でサンプル 2 件が通る、残りで大文字小文字・年の桁数・一覧外の並びを試す"
  red_flags:
    - "TypeScript で localeCompare を使い、大文字で始まる書名の位置がずれる"
    - "年を文字列のまま比べて、3 桁の年を 4 桁の年より新しいと扱う"
    - "一覧に無いジャンルを、入力に出てきた順のまま並べる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 多キーソート・カスタム順序 / 題材: 図書館の新刊の棚入れ）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 複数キーでの並べ替えの定番。指定順と名前順が混ざる順序と、言語ごとの文字列比較の違い（localeCompare・PHP の数値文字列）を突く点が独自"
---

## 問題文

図書館で、新しく入った N 冊の本を棚に並べる順番を決めます。本 i は書名 t_i、ジャンル c_i、出版年 y_i を持ちます。館長からジャンルの並び順 g_1, g_2, …, g_G が指定されているので、次の規則で並べたときの書名を前から順に出力してください。

1. 一覧にあるジャンルの本を先に、一覧の順（g_1 が最初）に並べる。一覧に無いジャンルの本は、一覧にあるジャンルの本よりすべて後ろに、ジャンル名の昇順で並べる。
2. ジャンルが同じ本どうしは、出版年の新しい順に並べる。
3. ジャンルも出版年も同じ本どうしは、書名の昇順に並べる。

文字列（ジャンル名・書名）の昇順は**文字コード順**です。先頭から 1 文字ずつ比べて、最初に違う文字の文字コード（数字 < 英大文字 < 英小文字）で決め、片方がもう片方の先頭部分と一致するなら短いほうが前です。

## 制約

入力:

```
G
g_1 g_2 … g_G
N
t_1 c_1 y_1
…
t_N c_N y_N
```

出力: N 行。並べた順に書名を 1 行に 1 つずつ。

- 1 ≤ G ≤ 50、1 ≤ N ≤ 3×10^4、1 ≤ y_i ≤ 2026（G, N, y_i は整数）
- g_1, …, g_G はすべて異なる。g_k と c_i は英小文字からなる 1〜10 文字の文字列
- t_i は英大文字・英小文字・数字からなる 1〜20 文字の文字列で、すべて異なる
- 制限時間 2 秒（Python/PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（`enum` など変換が必要な構文は不可）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
2
novel history
5
River novel 2001
Harbor history 1998
Sky novel 2015
Atlas history 1998
Castle novel 2001
```

出力例 1:

```
Sky
Castle
River
Atlas
Harbor
```

novel の 3 冊が先です（2015 年の Sky、次に 2001 年の 2 冊が書名順で Castle → River）。その後に history の 2 冊が並びます（同じ 1998 年なので Atlas → Harbor）。

入力例 2:

```
1
art
4
Moss botany 2005
Waves music 2020
Color art 1990
Bach music 2020
```

出力例 2:

```
Color
Moss
Bach
Waves
```

一覧に無いジャンル botany と music は art の後ろに、ジャンル名の昇順（botany → music）で並びます。music の 2 冊は同じ年なので書名順（Bach → Waves）です。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「一覧のジャンルが 1 冊も無いことは？」→ ある。並びには影響しない。
  - 「書名が同じ本はありますか」→ 無い（すべて異なる）。
  - 「昇順は大文字小文字を区別しますか」→ 区別する。文字コード順（問題文の定義どおり。`Zoo` は `apple` より前）。
  - 「一覧に無いジャンルの中でも年と書名の規則は使いますか」→ 使う。ジャンル名で分けたあと、年の新しい順・書名の昇順。
- 見るところ: キーの優先順を口で整理してから書けるか。言語の文字列比較の仕様を知っているか。
- ヒントの出し順:
  1. 「並べる基準を優先度の高い順に 3 つ書き出すと？」
  2. 「年の新しい順を、昇順のソートで扱うにはキーをどう変えますか」
  3. 「一覧に無いジャンルを、一覧のどれよりも後ろにするには順位をいくつにしますか」

## 振り返り用解説（終了後のみ表示）

**想定解**: ジャンル名 → 添字の辞書 `rank` を作り、各本のキーを `(rank.get(c, G), 一覧外ならジャンル名・一覧内なら "", −y, t)` として昇順ソートします。一覧外の本は順位がすべて G なので一覧の本より後ろになり、その中はジャンル名で分かれます。年は符号を反転して降順を昇順に直します。時間 O(N log N)（比較 1 回は書名の長さ ≤ 20）。

**素朴解との比較**: 安定ソートを優先度の低い順に 3 回（書名 → 年の降順 → ジャンル）かけても正しく並びます。挿入ソートのような O(N²) は N = 3×10^4 で約 4.5×10^8 回の比較になり、Python では間に合いません。

**よくある誤り**:
- 文字コード順でない比較（TS の `localeCompare`、大文字小文字を無視した比較）→ hidden-trap-ascii-case・hidden-trap-ties-prefix。
- 年を文字列のまま比べる → hidden-trap-year-digits（"794" と "1603"）。
- 一覧外のジャンルを入力順のまま並べる → hidden-trap-unlisted-order。
- PHP で `<=>` や `sort()` を使う → "10" と "9"、"1e3" と "999" が数値として比べられる（hidden-trap-numeric-titles）。

**別解**: 比較関数（cmp）を書く。C の `qsort`・Go の `sort.Slice`・Rust の `sort_by` では自然。ジャンルごとのバケットに分けてから、各バケットを (−年, 書名) でソートしてつなげてもよい。

**言語別の注意**:
- TypeScript: `a.localeCompare(b)` はロケール依存で `apple` が `Banana` より前になる。`a < b ? -1 : a > b ? 1 : 0` で比べる（英数字なら < は文字コード順）。`sort()` には必ず比較関数を渡す。
- PHP: `usort($a, fn($x, $y) => ... ?: strcmp($x[0], $y[0]))` のように `strcmp` を使う。`$x <=> $y` は数値文字列を数値として比べる。
- C: `strcmp` は文字コード順。`qsort` の比較関数で年は `yb - ya`（範囲が小さいので溢れない）。
- Go: `string` の `<` はバイト順。`sort.Slice` は安定ではないが、書名がすべて異なりキーが全順序なので問題ない。
- Rust: `String` の `Ord` はバイト順。`a.0.cmp(&b.0).then(b.2.cmp(&a.2)).then_with(|| a.1.cmp(&b.1))` のようにつなぐ。
- Python: `str` の比較はコードポイント順（英数字は文字コード順と同じ）。キーにタプルを使うのが簡単。
