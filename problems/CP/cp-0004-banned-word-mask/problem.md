---
id: cp-0004
slug: banned-word-mask
title: "掲示板の禁止語マスク"
category: CP
tier: core
difficulty: L1
time_limit: 20
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "禁止語が aa で本文が aaa のときは、何文字が伏せられますか"
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
    text: "|S| ≤ 1000、禁止語は 10 個・各 10 文字以下なので、本文の全位置 × 全禁止語を比べても 10^5 回程度で十分と見積もる"
    weight: 3
  - id: tp2
    text: "素朴な replace（Python の str.replace、PHP の str_replace など）は重なった一致を拾わず、置き換えた後の文字列で次の語を探すと一致を見落とす、と aa / aaa や abc / cd / abcd の例で示す"
    weight: 2
  - id: tp3
    text: "観察: 原文の上で一致位置だけを探し、長さ |S| の真偽値配列に印を付けてから、最後に印の付いた文字を * に変える。重なりも禁止語の順序も気にしなくてよくなる"
    weight: 3
  - id: tp4
    text: "エッジ: 禁止語が本文より長い、本文全体が禁止語、一致が 1 つも無い（そのまま出力）、空白が 2 つ以上続く本文"
    weight: 1
  - id: tp5
    text: "本文は空白を含むので行単位で読み、split して空白 1 つで join し直さない。比較は exact なので、空白の数も原文どおりに出力されるかを自作入力で確かめる"
    weight: 1
requirements:
  - id: mask_all
    label: "原文で禁止語と一致する部分の文字を、すべて * にして出力する"
  - id: overlap
    label: "重なった一致（aaa の中の aa 2 つ）や、別の禁止語の一致との重なりも漏れなく伏せる"
  - id: preserve_text
    label: "一致しない文字は、空白の数や記号も含めて原文のまま出力する"
rubric_hints:
  correctness: "hidden-trap-overlap*（重なり）、hidden-trap-no-research*（置換後の文字列で探さない）、hidden-trap-spaces*（空白の保持）が通れば合格"
  explanation: "「一致を探す」と「* に変える」を分ける理由を、具体例（abc と cd に対する abcd）で説明できれば加点"
  time_management: "3 分で「重なり」と「原文で判定」の意味を例で確認し、10 分でサンプル 3 件が通り、残りで aa / aaa と連続した空白を試す"
  red_flags:
    - "禁止語ごとに replace を順に適用し、置き換えた後の文字列で次の禁止語を探す"
    - "本文を split() で単語に分け、空白 1 つで join し直す（連続した空白が消える）"
    - "scanf(\"%s\") や input().split() で本文の最初の単語だけを読む"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 文字列走査・一致位置への印付け / 題材: 掲示板の投稿の禁止語を伏せ字にする）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

掲示板に投稿された本文 S のうち、禁止語にあたる部分を伏せ字にします。禁止語は N 個あり、T_1, T_2, …, T_N です。

S の中で、どれかの禁止語と完全に一致する部分（単語の一部でもかまいません）をすべて見つけ、その部分に含まれる文字を 1 文字ずつ `*` に置き換えた文字列を出力してください。

- 一致する部分どうしが重なっている場合や、別の禁止語の一致と重なっている場合も、それぞれの一致に含まれる文字をすべて `*` にします。
- 一致するかどうかは、置き換える前の S で判定します。
- 一致しない文字は、空白も含めてそのまま出力します。

## 制約

入力:

```
N
T_1
T_2
…
T_N
S
```

出力: 伏せ字にした S を 1 行に出力してください。空白も含めて 1 文字ずつ比較します。

- 1 ≤ N ≤ 10
- T_i は英小文字からなる 1 文字以上 10 文字以下の文字列
- S は英小文字・空白・記号（`.` `,` `!` `?`）からなる 1 文字以上 1000 文字以下の文字列
- S の先頭と末尾の文字は空白ではない。空白が 2 つ以上続くことはある
- N は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
2
bad
ugly
this is a bad and ugly idea.
```

出力例 1:

```
this is a *** and **** idea.
```

入力例 2:

```
1
cat
concatenate the catalog, cat!
```

出力例 2:

```
con***enate the ***alog, ***!
```

単語の一部でも、禁止語と一致する部分は伏せます。

入力例 3:

```
1
spam
no problem here.
```

出力例 3:

```
no problem here.
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「大文字はありますか」→ ありません。英小文字・空白・記号だけです。
  - 「禁止語 aa、本文 aaa はどうなりますか」→ 1〜2 文字目と 2〜3 文字目の両方が一致するので `***` です。
  - 「禁止語 abc と cd、本文 abcd は」→ 原文で abc（1〜3 文字目）と cd（3〜4 文字目）がどちらも一致するので `****` です。
  - 「同じ禁止語が 2 回書かれていることは」→ ありえますが、結果は変わりません。
- 見たいこと: replace を思い浮かべたときに、重なりと順序の問題に自分で気づくか。本文の読み方（行単位）を最初に決めるか。
- ヒントの出し順:
  1. 「禁止語 aa、本文 aaa で、あなたの方法は何を出力しますか」
  2. 「探すことと置き換えることを分けられませんか。原文のどの位置を伏せるかだけ先に記録したら？」
  3. 「本文に空白が 2 つ続く入力で、出力の空白の数は変わりませんか」
- 類題について: 伏せ字（マスク）処理は一般的な題材。重なりと「原文で判定」の規則の組み合わせは独自。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 長さ |S| の真偽値配列 mark を用意します。各禁止語 T について、S のすべての開始位置 i（0 ≤ i ≤ |S| − |T|）で `S[i .. i+|T|)` が T と一致するかを調べ、一致したら mark[i .. i+|T|) を真にします。最後に、mark が真の文字を `*` に、それ以外を元の文字のまま出力します。時間 O(N × |S| × |T|) ≤ 10 × 1000 × 10 = 10^5、空間 O(|S|)。

**素朴解が落ちる理由**:
- `str.replace("aa", "**")` などは、一致を左から重ならないように探すので、`aaa` が `**a` になります（hidden-trap-overlap）。
- 禁止語を順に置き換え、置き換えた後の文字列で次の語を探すと、`abc` を伏せた時点で `c` が `*` になり、`cd` が見つからなくなります（hidden-trap-no-research。禁止語の順序を入れ替えた -2 も同じ）。
- 本文を空白で split して join し直すと、連続した空白が 1 つになり exact 比較で落ちます（hidden-trap-spaces）。

**別解**: 位置 i ごとに「i から始まる最も長い一致の終わり」を求め、まだ伏せる範囲が続いているかをカウンタで持つと、印の配列を使わずに 1 回の走査で出力できます。ただし、印の配列のほうが誤りにくいです。

**言語別の注意**:
- C: `scanf("%s")` は空白で止まる。本文は `fgets` か、まとめて読んだバッファを改行で区切る。末尾の `\n`（と `\r`）を落としてから処理する。
- Python: `input().split()` ではなく、`sys.stdin.read().split("\n")` の行で読む。
- TypeScript: `input.split("\n")` の各行は `\r` を含みうる。`trimEnd()` は末尾の空白も消すが、この問題では本文の末尾は空白ではないので使ってよい。
- PHP: `str_replace` は重なりを拾わない。`substr_compare` か `substr` で位置ごとに比べる。
- Go / Rust: 文字列をバイト列として扱ってよい（ASCII のみ）。出力はバイト列を作ってから 1 回で書く。
