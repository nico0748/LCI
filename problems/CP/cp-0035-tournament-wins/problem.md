---
id: cp-0035
slug: tournament-wins
title: "トーナメントの勝ち数"
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
    text: "強さが同じ対戦で、どちらを勝たせていますか"
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
    text: K ≤ 17 なので選手は最大 2^17 = 131072 人、試合は全部で 2^K − 1 = 131071 回。回戦ごとに配列が半分になるシミュレーションは合計 O(2^K) で十分と宣言する
    weight: 3
  - id: tp2
    text: 選手ごとに「各回戦の区間（2^r 人）の最強か」を区間全体で調べ直す方法は 1 人あたり O(2^K)、全体で O(4^K) ≈ 1.7×10^10 になり使えない、と比較する
    weight: 2
  - id: tp3
    text: 回戦ごとに「勝ち残った選手番号の列」を持ち、隣り合う 2 人を (強さ, −番号) で比べる。強さが同じなら番号が小さい方で、表の左右ではない
    weight: 3
  - id: tp4
    text: K=0（1 人だけ、試合なしで勝利数 0）、全員同じ強さ（優勝は 1 番）、右側の選手の方が番号が小さい引き分け、P が番号順でない表、を列挙する
    weight: 1
  - id: tp5
    text: 2^18 個近い整数をまとめて読み、勝利数は番号順に join して 1 行で出す。入力例 1 を手で追い、引き分けで右が勝つ入力を自作して試す
    weight: 1
requirements:
  - id: correct_output
    label: 1 行目に優勝者の番号、2 行目に選手 1〜2^K の勝利数を番号順に出力する
  - id: tie_rule
    label: 強さが同じ対戦では、表の位置に関係なく選手番号が小さい方を勝たせる
  - id: bracket_order
    label: 表の並び P に従って各回戦の組み合わせを作り、K=0（1 人だけ）も正しく扱う
rubric_hints:
  correctness: "hidden-trap-tie-by-number（右が番号最小の引き分け）と hidden-trap-bracket-order（P が番号順でない）が通れば合格。hidden-max-* は入出力の速さを見る"
  explanation: "勝者の列を選手番号で持つ理由（強さだけでは引き分けの判定と勝利数の記録ができない）を説明できれば加点"
  time_management: "5 分で回戦ごとのシミュレーションを宣言し、15 分以内に入力例 1・2 が通る"
  red_flags:
    - "引き分けで左側（s[a] >= s[b]）を勝たせ、表の右側にいる番号の小さい選手を負けにする"
    - "強さを表の順に並べ替えた配列だけを持ち、勝利数を選手番号ではなく表の位置で数えて出力する"
    - "K=0 で試合のループに入らず、優勝者の行を出力し忘れる"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 配列を半分にしていくシミュレーション / 題材: 表の並びが番号順でない勝ち抜きトーナメント）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 2^K 人のトーナメントのシミュレーションは定番。表の並びを番号と分け、引き分けを番号で決める規則で左右の取り違えを突く形にした"
---

## 問題文

2^K 人の選手（1〜2^K 番）が勝ち抜きトーナメントで戦います。選手 i の強さは s_i です。トーナメント表には、左から順に選手 P_1, P_2, …, P_{2^K} が並んでいます。

1 回戦では、表の左から 2 人ずつ（P_1 と P_2、P_3 と P_4、…）が対戦します。2 回戦からは、前の回戦の勝者を表の左から順に並べ、同じように 2 人ずつ対戦させます。これを 1 人が残るまで繰り返します。

対戦では強さが大きい方が勝ちます。強さが同じときは、選手番号が小さい方が勝ちます（表の左右は関係ありません）。

優勝者の番号と、選手 1〜2^K それぞれの勝利数を求めてください。

## 制約

入力:

```
K
s_1 s_2 … s_{2^K}
P_1 P_2 … P_{2^K}
```

出力: 2 行（最後に改行を付ける）。1 行目に優勝者の番号、2 行目に選手 1, 2, …, 2^K の勝利数を、この順に空白区切りで出力する。

- 0 ≤ K ≤ 17
- 1 ≤ s_i ≤ 10^9
- P_1, …, P_{2^K} は 1〜2^K の並べ替え
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
2
5 3 8 3
2 4 1 3
```

出力例 1:

```
3
0 1 2 0
```

入力例 2:

```
3
4 9 2 6 9 1 5 3
7 2 3 5 8 1 4 6
```

出力例 2:

```
2
1 3 0 2 1 0 0 0
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「強さが同じなら、表の左にいる方が勝ちですか」→ いいえ、選手番号が小さい方。表の位置は関係ない。
  - 「K = 0 はありますか」→ ある。選手 1 人で試合は無く、優勝は 1 番、勝利数は 0。
  - 「2 回戦の組み合わせは、1 回戦の勝者を番号順に並べ直すのですか」→ いいえ、表の左から順（1 回戦で隣り合っていた組の勝者どうし）。
- 入力例 1 の流れ: 1 回戦は 2 番と 4 番（どちらも強さ 3 → 番号の小さい 2 番）、1 番と 3 番（5 と 8 → 3 番）。決勝は 2 番と 3 番で 3 番が勝つ。
- ヒントの出し順:
  1. 「1 回戦が終わったあと、何を覚えておけば 2 回戦の組み合わせが作れますか」（勝者の選手番号の列）
  2. 「強さが同じ 2 人の比較を、番号を使って 1 つの条件式にしてみてください」
  3. 「表の右側の選手の方が番号が小さい引き分けを、自分で作って試してみましょう」
- 計算量はほぼ問わない（全試合で 131071 回）。最大ケースは入出力の速さの確認。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 現在の回戦に残っている選手番号の列 `line`（最初は P）を持ちます。`line` を 2 つずつ区切り、`a = line[2i]`、`b = line[2i+1]` について「`s[a] > s[b]`、または `s[a] == s[b]` かつ `a < b`」なら a、そうでなければ b を勝者として `wins[勝者] += 1`、勝者を次の列に左から順に入れます。列の長さが 1 になったら、その選手が優勝者です。試合数は合計 2^K − 1 回で、O(2^K) です。

**素朴解が落ちる理由**: 計算量の罠はありません（選手ごとに区間の最強を調べ直す O(4^K) のような書き方をしない限り）。落ちるのは規則の取り違えです。引き分けで表の左側を勝たせると、右側の選手の方が番号が小さい対戦で WA になります（hidden-trap-tie-by-number、hidden-trap-all-equal）。強さを表の順に並べ替えた配列だけを持つと、勝利数を選手番号に戻せなくなります。

**別解**: 選手 x が r 回戦に勝つのは、表の位置を含む長さ 2^r の区間（2^r ずつ区切ったもの）で x が最強のときです。区間の最強をセグメント木のように下から作れば、同じく O(2^K) で全員の勝利数が分かります（中身は想定解と同じ計算）。再帰で「区間の勝者を返す関数」を書いても深さは K ≤ 17 なので問題ありません。

**言語別の注意**:
- Python: 2^18 個近い整数は `sys.stdin.buffer.read().split()` で一度に読む。出力は `" ".join(map(str, wins))`。
- TypeScript: 数値の比較は `>` で十分（文字列のまま比べると "10" < "9" になる）。出力は配列を `join(" ")`。
- C / Go / Rust: 強さは 10^9 以下なので 32bit で足りる。出力は 1 つの大きなバッファに書いてから出す。
- 勝利数の配列は「選手番号」で引く（`wins[a]`）。表の位置（`wins[2i]`）と混ぜない。
