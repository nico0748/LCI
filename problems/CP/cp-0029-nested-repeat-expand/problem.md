---
id: cp-0029
slug: nested-repeat-expand
title: "入れ子の繰り返し記法の展開"
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
    text: "括弧の中にさらに括弧があるとき、どの順番で展開しますか"
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
    text: "|S| ≤ 1000、展開後 ≤ 10^5、入れ子 ≤ 50 段なので、各段で文字列を作り直しても高々 50 × 10^5 = 5×10^6 文字で間に合うと見積もる"
    weight: 3
  - id: tp2
    text: "内側の括弧から文字列置換を繰り返す方法も書けるが、毎回全体を作り直すので遅く、条件も複雑になる。左から 1 回走査するスタック（または再帰下降）と比べて選ぶ"
    weight: 2
  - id: tp3
    text: "スタックに「今の括弧の中で作った文字列」と回数を積む: 数字は複数桁まとめて読み、( で新しい層、) で層を閉じて回数分つなげ、1 つ下の層に足す。数字の直後が英小文字ならその 1 文字だけを繰り返す"
    weight: 3
  - id: tp4
    text: "複数桁の回数（12(…)・999a）、回数 1、50 段の入れ子、) の直後の文字や数字（2(ab)c3(d)）、3ab が aaab になることを自作して確かめる"
    weight: 1
  - id: tp5
    text: "出力は展開した 1 行（最大 10^5 文字）。断片を配列に溜めて最後に join し、まとめて書く。サンプル 2（10q と 2(yz) の入れ子）を手で追う"
    weight: 1
requirements:
  - id: correct_output
    label: "記法 S を規則どおりに展開した文字列を 1 行に出力する"
  - id: multi_digit
    label: "2 桁以上の回数（例: 12(…)、999a）を 1 つの数として読む"
  - id: scope
    label: "回数は直後の英小文字 1 文字、または直後の ( … ) 1 つだけに掛かる（) の後ろの文字や 3ab の b は繰り返さない）"
  - id: deep_nest
    label: "50 段の入れ子や回数 1 の入れ子でも正しく展開できる"
rubric_hints:
  correctness: "hidden-trap-multi-digit・hidden-trap-letter-count（回数の掛かる範囲）・hidden-trap-after-paren・hidden-trap-deep-nest が通れば合格ライン。TLE は狙っていない"
  explanation: "スタック（または再帰下降）で何を積むかを説明でき、展開後の長さの上限から計算量を見積もれれば加点"
  time_management: "8 分以内にスタックの中身（文字列と回数）と 3 種類の要素の読み方を宣言、20 分以内にサンプル 3 件が通る、残りで 50 段と ) の直後を試す"
  red_flags:
    - "回数を 1 桁だけ読み、10q や 12(…) を 1 と 0q などと誤解する"
    - "回数を直後の 1 要素ではなく後ろ全体に掛ける（3ab を aaabbb、2(ab)c を ababcc にする）"
    - "括弧の対応を数えずに、最初の ) までを中身とみなす（入れ子で崩れる）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: スタック・再帰下降による構文解析 / 題材: 編み物の模様の繰り返し記法。数字の直後が 1 文字か括弧かで掛かる範囲が変わる）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 数字と括弧の繰り返しを展開する定番問題（Decode String 型）。「数字の直後の英小文字 1 文字だけ」の規則と、括弧を ( ) にした記法で差別化した"
---

## 問題文

編み物の模様は、編み目の種類を英小文字 1 文字で表し、繰り返しを数字と括弧で短く書いた記法 S で表されています。S を展開した文字列を出力してください。記法は次の規則で展開されます。

- 英小文字 1 文字は、その文字そのもの
- 正の整数 k の直後に英小文字 c があるとき、「kc」は c を k 個並べたもの
- 正の整数 k の直後に「(X)」があるとき、「k(X)」は記法 X を展開した文字列を k 回つなげたもの
- 記法をいくつか並べたものは、それぞれを展開して順につなげたもの

例えば 2(ab3c)d は abcccabcccd に、3ab は aaab に展開されます。

## 制約

入力:

```
S
```

出力: S を展開した文字列を 1 行に出力する（最後に改行を付ける）。

- 1 ≤ |S| ≤ 1000
- S は英小文字・数字・`(`・`)` からなり、上の規則に従う正しい記法
- 数字の直後には必ず英小文字か `(` がある。`(` の直前には必ず数字がある。`()` のような空の括弧は無い
- 繰り返し回数は 1 以上 999 以下で、先頭に 0 は付かない
- 括弧の入れ子は 50 段以下
- 展開後の文字列の長さは 1 以上 10^5 以下
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
2(ab3c)d
```

出力例 1:

```
abcccabcccd
```

入力例 2:

```
3(x2(yz))w10q
```

出力例 2:

```
xyzyzxyzyzxyzyzwqqqqqqqqqq
```

入力例 3:

```
1(a1(b))2(c)
```

出力例 3:

```
abcc
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「回数は 1 桁ですか」→ 1〜999。入力例 2 の 10q が確認用。
  - 「3ab は (ab) を 3 回？」→ いいえ。a だけを 3 個で aaab（問題文の例）。
  - 「括弧の前に数字が無いことは？」→ 無い。必ず数字がある。
  - 「途中の文字列が 10^5 を超えることは？」→ 回数は 1 以上なので、途中の文字列は最終結果より長くならない。
- ヒントの出し順:
  1. 「( を見たとき、いったん何を覚えておけば、) で元に戻れますか」（それまでに作った文字列と、この括弧の回数）
  2. 「それを入れ子の深さぶん積むには何を使いますか」（スタック。あるいは「) まで読んで展開結果を返す」再帰関数）
  3. 「数字を読み終えたら、次の 1 文字で何が変わりますか」（英小文字ならその文字を k 個、( なら新しい層）
- 再帰下降で書く場合も深さは 50 段なので、再帰の深さの心配は無い（Python の既定 1000 段で足りる）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 「今の括弧の中で作った断片の列」を要素とするスタックと、開いている括弧の回数のスタックを持ち、S を左から 1 回走査します。

- 英小文字: 今の層に足す
- 数字: 続く数字をまとめて読んで k にする。次が英小文字 c なら、今の層に c を k 個足して c も読み進める。次が ( なら、回数スタックに k を積み、新しい空の層を積む
- ): 今の層を取り出してつなげ、回数スタックから k を取り出して k 回つなげたものを 1 つ下の層に足す

最後に一番下の層をつなげて出力します。各文字は高々 50 段ぶんコピーされるので、時間・空間とも O(50 × 展開後の長さ) = 5×10^6 程度です。

**素朴解との比較**: 「中身が英小文字だけの括弧を探して置き換える」を繰り返す方法も、この制約なら間に合います（置き換えは高々 |S| 回、1 回あたり 10^5 文字）。ただし「kc」の規則との順序や、正規表現の書き方で間違えやすくなります。落ちる原因はほとんどが読み取りの規則です: 回数を 1 桁だけ読む（hidden-trap-multi-digit）、回数を後ろ全体に掛ける（hidden-trap-letter-count / hidden-trap-after-paren）。

**別解**: 再帰下降。`parse(i)` が「位置 i から ) か終端までを展開した文字列と、読み終えた位置」を返すようにすると、規則をそのままコードにできます。

**言語別の注意**:
- C: 展開後は最大 10^5 文字なので、層ごとに `char` の可変長バッファ（`realloc`）を持つか、層ごとの開始位置だけを積んで 1 本のバッファの末尾で複製する（`memcpy` で k−1 回）。最後に `'\0'` を付けて `puts`。
- Rust: `Vec<String>` をスタックにして、`)` で `body.repeat(k)` を下の層に `push_str`。
- Go: `strings.Builder` か `[]byte` のスタック。`strings.Repeat` が使える。
- TypeScript: 文字列の `repeat(k)`。`+=` の連結でもこの規模なら問題ない。
- PHP: `str_repeat($body, $k)`。`ctype_digit` で数字を判定する。
- Python: 断片をリストに溜めて `"".join`。`s * k` で繰り返す。
