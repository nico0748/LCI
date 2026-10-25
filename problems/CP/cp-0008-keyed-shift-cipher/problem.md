---
id: cp-0008
slug: keyed-shift-cipher
title: "鍵付きシフト暗号の復号"
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
  - at_sec: 600
    text: "暗号文の a を鍵 z の分だけ戻すと、あなたの式ではどの文字になりますか"
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
    text: "|S| ≤ 2×10^5 なので 1 文字 O(1) の O(|S|) で十分。ただし文字列を 1 文字ずつ += で連結すると、言語によっては O(|S|^2) = 4×10^10 バイトのコピーになると見積もる"
    weight: 3
  - id: tp2
    text: "素朴な書き方の落とし穴: (c − k) % 26 は C / Go / Rust / TS / PHP では負になりうる（a を 1 戻すと記号 ` になる）。Go の string += や C の strcat を 2×10^5 回繰り返すと遅い"
    weight: 2
  - id: tp3
    text: "観察: 鍵の位置 j は「それまでに戻した英字の個数」で、英字のときだけ進める。戻した文字は (c − base − k + 26) % 26 + base（base は a か A）で、大文字と小文字を保つ"
    weight: 3
  - id: tp4
    text: "エッジ: 英字が 1 つも無い文（そのまま出力）、a を z の分だけ戻す（b になる）、大文字と小文字の混在、鍵が文中の英字より長い、空白の連続"
    weight: 1
  - id: tp5
    text: "暗号文は空白を含むので行単位で読み、行末の改行（CR を含む）だけを落とす。出力はバイト配列や StringBuilder に溜めて 1 回で書く。exact 比較なので空白の数も保つ"
    weight: 1
requirements:
  - id: decrypt
    label: "英字を鍵の文字の分だけ戻した元の文を出力する（大文字は大文字、小文字は小文字のまま）"
  - id: key_advance
    label: "鍵の位置は英字を戻したときだけ進め、英字以外の文字はそのまま出力する"
  - id: wrap_around
    label: "a より前に戻るときは z 側へ回り込む（負の剰余で記号に化けない）"
  - id: within_limit
    label: "|S| = 2×10^5 で制限時間内に終わる（文字列の組み立てを O(|S|) に保つ）"
rubric_hints:
  correctness: "hidden-trap-negative-mod（負の剰余）、hidden-trap-key-advance*（鍵の進め方）、hidden-trap-uppercase、hidden-trap-spaces（空白の保持）、hidden-max-*（2×10^5 文字）が通れば合格"
  explanation: "使っている言語の % が負の数をどう扱うかを説明し、+26 してから % を取る理由を言えれば加点。文字列の連結の計算量に触れられればさらに加点"
  time_management: "5 分で鍵の進め方と負の剰余の扱いを決め、15 分でサンプル 3 件が通り、残りで a を z で戻すケースと連続した空白を試す"
  red_flags:
    - "(c - k) % 26 をそのまま使い、C / Go / Rust / TS で負の値から記号が出る"
    - "英字以外の文字（空白・数字・記号）でも鍵の位置を進める"
    - "本文を split して join し直し、連続した空白を 1 つにしてしまう"
    - "Go で res += string(c) を 2×10^5 回繰り返す（gen/naive.go は hidden-max で TLE する）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 剰余演算・文字列の組み立て / 題材: 英字だけを鍵で進める社内連絡用のシフト暗号）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: ヴィジュネル暗号（鍵の文字ごとにずらす換字式暗号）の復号。英字以外で鍵を進めない・大文字を保つ規則と入出力は独自"
---

## 問題文

英小文字だけからなる鍵 K を使う暗号があります。暗号文は、元の文に含まれる英字を先頭から順に見て、j 番目（0 始まり）の英字を、鍵の (j mod |K|) 文字目（0 始まり）の分だけアルファベット順に進めて作ります。進める量は鍵の文字が `a` なら 0、`b` なら 1、…、`z` なら 25 で、`z` の次は `a` に戻ります。大文字は大文字のまま、小文字は小文字のまま進めます。

英字以外の文字（数字・空白・記号）は変えずにそのまま残し、鍵の位置も進めません。

鍵 K と暗号文 S が与えられるので、元の文を出力してください。

## 制約

入力:

```
K
S
```

出力: 元の文を 1 行に出力してください。空白も含めて 1 文字ずつ比較します。

- 1 ≤ |K| ≤ 1000、K は英小文字からなる
- 1 ≤ |S| ≤ 2×10^5
- S は ASCII の表示可能な文字（空白を含む。文字コード 32〜126）からなる
- S の先頭と末尾の文字は空白ではない。空白が 2 つ以上続くことはある
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
key
Rijvs, Uyvjn!
```

出力例 1:

```
Hello, World!
```

`R` は鍵の `k`（10）だけ戻して `H`、`i` は `e`（4）だけ戻して `e`、`j` は `y`（24）だけ戻して `l` です。`,` と空白では鍵が進まないので、`U` は 6 番目の英字として鍵の `y`（24）だけ戻し、`W` になります。

入力例 2:

```
lci
Xgme cb 7 ao, Olvm M.
```

出力例 2:

```
Meet at 7 pm, Gate B.
```

入力例 3:

```
abc
2026-10-25 12:00
```

出力例 3:

```
2026-10-25 12:00
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「鍵に大文字は含まれますか」→ 含まれません（英小文字だけ）。
  - 「大文字の英字も戻しますか」→ 戻します。大文字のまま、同じ量だけ戻します。
  - 「数字や空白で鍵は進みますか」→ 進みません。英字を 1 つ戻したときだけ進みます。
  - 「文字コード 127 以上（日本語など）は来ますか」→ 来ません。
- 見たいこと: 使っている言語の `%` の仕様を自分で確かめるか（例: C で `-1 % 26`）。文字列を 1 文字ずつ連結する書き方の計算量に気づくか。
- ヒントの出し順:
  1. 「暗号文の a を鍵 z の分だけ戻すと何になりますか。あなたの式を手で計算してみてください」
  2. 「鍵の位置を進める条件は何ですか。空白や `,` のときは？」
  3. 「2×10^5 文字の出力をどう組み立てていますか。連結のたびに何バイトコピーされますか」
- 入力例 1 の説明で「鍵が進まない」ことを見せているので、hidden-trap-key-advance で落ちた場合は、問題文の規則を読み直したかを振り返らせる。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 鍵の位置 j = 0 から始め、S を 1 文字ずつ見ます。小文字 c なら `(c − 'a' − k + 26) % 26 + 'a'`、大文字なら `'A'` を基準に同じ計算をします（k は鍵の j mod |K| 文字目の値）。英字のときだけ j を 1 進め、それ以外の文字はそのまま出力します。結果はバイト配列（または配列に溜めて join）で組み立てて 1 回で出力します。時間 O(|S| + |K|)、空間 O(|S|)。

**素朴解が落ちる理由**:
- C / Go / Rust（`i32` の `%`）/ TypeScript / PHP の `%` は、割られる数の符号を引き継ぎます。`(c − k) % 26` は負になり、'a' に足すと '`' などの記号になります（hidden-trap-negative-mod）。
- 空白や記号でも鍵を進めると、2 文字目以降がずれます（hidden-trap-key-advance）。
- 本文を `split` して `join` し直すと連続した空白が消えます（hidden-trap-spaces。比較は exact）。
- Go の `res += string(c)` は毎回新しい文字列を作るので、2×10^5 文字で約 2×10^10 バイトのコピーになり、このコンテナで約 6 秒かかります（gen/naive.go、hidden-max-* で TLE）。C の `strcat` も毎回末尾を探すので O(|S|^2) です。

**別解**: 26×26 の復号表（暗号文字 × 鍵文字 → 元の文字）を先に作っておくと、剰余を 1 回も書かずに済みます。

**言語別の注意**:
- C: `fgets` で 2×10^5 + 数文字のバッファに読み、末尾の `\n` と `\r` を落とす。`char` を `int` に広げてから計算する。
- Go: `[]byte` に `append` して最後に `os.Stdout.Write`。`bufio.Reader.ReadString('\n')` で 1 行ずつ読む。
- Rust: `Vec<u8>` に push し、`String::from_utf8` か `write_all` で出す。`(c - b'a')` は `u8` の引き算なので、`i32` に広げてから鍵を引くか `rem_euclid` を使う。
- TypeScript: `charCodeAt` と `String.fromCharCode` を使い、文字の配列を `join("")` する。`%` は負になる。
- PHP: `ord` / `chr` を使い、配列に溜めて `implode` する。`%` は負になる。
- Python: `%` は 0〜25 を返すので、そのままでよい。出力は `"".join`。
