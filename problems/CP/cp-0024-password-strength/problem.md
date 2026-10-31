---
id: cp-0024
slug: password-strength
title: "パスワード強度チェック"
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
    text: "規則を 2 つ以上破っているパスワードでは、どの番号を出しますか"
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
    text: "N ≤ 100、長さ ≤ 100 なので 1 件ずつ素直に走査して O(N × 長さ) で十分。ユーザー名の包含も O(長さ^2) で問題ないと宣言する"
    weight: 3
  - id: tp2
    text: "規則 1〜5 を番号順に判定し、破った時点で番号を返す関数にする。全部を判定してから最小番号を選ぶ方法と比べ、早期 return の方が順序を間違えにくいと言う"
    weight: 2
  - id: tp3
    text: "文字種は英大文字・英小文字・数字・記号 !#$%&*+-=?@_ の 4 種類から 3 種類以上。記号表に無い文字（~ や ( など）は規則 2 で先に弾く"
    weight: 3
  - id: tp4
    text: "長さ 7/8/64/65 の境界、末尾で終わる 3 連続（!!!）、ちょうど 2 連続は OK、ユーザー名の大文字小文字違い、ユーザー名がパスワードより長い場合を自作して試す"
    weight: 1
  - id: tp5
    text: "1 行は「ユーザー名 空白 パスワード」で、パスワードに空白は無い。出力は OK か番号を N 行。サンプル 2 の Kai（規則 1 と 5 を破る → 1）を手で追う"
    weight: 1
requirements:
  - id: correct_output
    label: "各行について、すべての規則を満たせば OK、そうでなければ破った規則のうち最も番号の小さいものを出力する"
  - id: length_boundary
    label: "長さ 8 と 64 は規則 1 を満たし、7 と 65 は破る"
  - id: run_at_end
    label: "パスワードの末尾で終わる 3 連続も規則 4 の違反として検出し、2 連続は違反にしない"
  - id: username_case
    label: "ユーザー名の包含を英大文字と英小文字を区別せずに判定する"
rubric_hints:
  correctness: "hidden-trap-rule-order（判定順）・hidden-trap-tail-run（末尾の 3 連続）・hidden-trap-username-case・hidden-trap-length-boundary が通れば合格ライン。TLE は狙っていない"
  explanation: "規則ごとに小さな判定を並べ、最初に破ったもので return する構成を説明できれば加点。連続の数え方（数えた直後に判定）を言えるとよい"
  time_management: "5 分以内に 5 規則の判定順と入力の読み方を宣言、13 分以内にサンプル 2 件が通る、残りで境界の長さと末尾の連続を試す"
  red_flags:
    - "連続を「次の文字が違ったら判定」と書き、末尾で終わる 3 連続（Mei2025!!!）を見逃す"
    - "すべての規則を判定して最後に破ったもの（または最大の番号）を出し、判定順を守らない"
    - "ユーザー名の包含を大文字小文字を区別して判定する"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 複数条件の順次判定・文字種判定 / 題材: 会員登録フォームのパスワード規則 5 か条）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

ある会員登録フォームでは、パスワードを次の規則 1〜5 で順に確かめます。

1. 長さが 8 文字以上 64 文字以下
2. 英大文字・英小文字・数字・記号 `!#$%&*+-=?@_` 以外の文字を含まない
3. 英大文字・英小文字・数字・記号（規則 2 の 12 種）の 4 種類のうち、3 種類以上を含む
4. 同じ文字が 3 つ以上続く箇所が無い
5. ユーザー名を含まない（英大文字と英小文字は区別しない）

N 件のユーザー名とパスワードの組について、すべての規則を満たすなら `OK` を、そうでなければ破った規則のうち最も番号の小さいものを出力してください。

## 制約

入力:

```
N
U_1 P_1
U_2 P_2
…
U_N P_N
```

U_i がユーザー名、P_i がパスワードで、1 つの空白で区切られています。

出力: N 行。i 行目に P_i の判定結果（`OK` または規則の番号）を出力する（最後に改行を付ける）。

- 1 ≤ N ≤ 100
- U_i は英字と数字からなる 3 文字以上 16 文字以下の文字列
- P_i は空白以外の ASCII 印字可能文字（`!` から `~` まで）からなる 1 文字以上 100 文字以下の文字列
- N は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
6
alice Abcdefg1
alice Abcdef1
bob Passw0rd~
carol Aa1aaa2b
dave xDAVEx12Q
erin Zz9!Zz9!
```

出力例 1:

```
OK
1
2
4
5
OK
```

入力例 2:

```
4
kai abcdefgh12
kai Kai
mei Mei2025!!!
sora SoRa_1234
```

出力例 2:

```
3
1
4
5
```

2 行目は規則 1 と 5 を破っているので 1、3 行目は規則 4 と 5 を破っているので 4 です。

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「2 つ以上破っていたら？」→ いちばん小さい番号だけ（入力例 2）。
  - 「記号は何でもいい？」→ 規則 2 の 12 種だけ。`~` や `(` は規則 2 違反。
  - 「規則 3 の記号に、規則 2 で弾かれる記号は数える？」→ 規則 2 を満たした後なので、数えるのは 12 種だけ。
  - 「ユーザー名に記号は？」→ 英字と数字だけ。
  - 「同じ文字の 3 連続は大文字小文字を区別する？」→ 区別する（`aAa` は 3 連続ではない）。区別しないのは規則 5 だけ。
- ヒントの出し順:
  1. 「規則ごとに『破っていたら番号を返す』関数を書いて、上から呼んだらどうなりますか」
  2. 「連続の長さはいつ判定しますか。最後の文字のあとで判定し忘れませんか」（数えた直後に `>= 3` を見る）
  3. 「大文字小文字を区別しない包含は、両方をどうしてから比べればよいですか」（両方を小文字にして部分文字列検索）
- paiza C 相当。規則の読み取りと境界の確認ができていれば十分。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 1 件ずつ、規則 1 → 5 の順に判定して、破った時点でその番号を出します。規則 2 と 3 は 1 回の走査でまとめられます（文字を「大文字・小文字・数字・12 種の記号・それ以外」に分け、「それ以外」が出たら 2、最後に種類数が 3 未満なら 3）。規則 4 は直前の文字と同じなら連続数を +1、違えば 1 に戻し、**更新した直後に** 3 以上かを見ます。規則 5 は両方を小文字にして部分文字列を探します。時間 O(N × 長さ^2)（包含判定の素朴な実装でも 100 × 100^2 = 10^6）。

**素朴解との比較**: 計算量はどう書いても間に合います（L1 なので TLE は狙っていません）。落ちる原因は規則の扱いです: 連続を「違う文字が来たら判定」と書くと末尾の 3 連続を見逃す（hidden-trap-tail-run）、全規則を判定して最後のものを出す（hidden-trap-rule-order）、長さの等号を間違える（hidden-trap-length-boundary）、大文字小文字を区別した包含（hidden-trap-username-case）。

**別解**: 正規表現で書くこともできます（規則 2: `^[A-Za-z0-9!#$%&*+\-=?@_]*$`、規則 4: `(.)\1\1`、規則 5: 大文字小文字を無視した検索）。文字クラスの中の `-` はエスケープするか末尾に置かないと範囲指定になる点に注意。

**言語別の注意**:
- C: 1 行を `scanf("%s %s", u, p)` で読める（空白を含まないので）。配列は 101 文字＋終端。小文字化は `tolower`、包含は `strstr`。`isalpha` などは `unsigned char` にキャストして渡す。
- Go: `strings.ToLower` と `strings.Contains`。1 行ずつ読むなら `bufio.Scanner`。
- Rust: `to_ascii_lowercase()` と `contains`。`as_bytes()` で 1 バイトずつ見ると速くて簡単。
- TypeScript: `toLowerCase().includes(...)`。正規表現を使うなら記号の `-` `*` `+` `?` `$` のエスケープに注意。
- PHP: `stripos($p, $u) !== false`（0 番目で見つかると `0` が返るので `!== false` で比べる）。
- Python: `user.lower() in pw.lower()`。`str.isalnum()` は全角や他の文字も真になるので、ASCII の範囲で判定する。
