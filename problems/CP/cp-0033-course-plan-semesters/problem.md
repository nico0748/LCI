---
id: cp-0033
slug: course-plan-semesters
title: "履修計画の最短学期数"
category: CP
tier: core
difficulty: L3
time_limit: 45
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "学期ごとに全科目を見直すやり方は、この制約で間に合いますか"
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
    text: N, M ≤ 10^5 なので O(N + M) のグラフ走査が目標。Python でも 2×10^5 回程度の辺の処理なら十分間に合うと宣言する
    weight: 3
  - id: tp2
    text: 素朴解の「学期ごとに全科目を見直して取れるものを取る」は 1 学期 O(N + M)、学期数 S は鎖なら 10^5 になるので O(S×(N+M)) = 2×10^10 で TLE
    weight: 2
  - id: tp3
    text: 段ごとの Kahn 法（トポロジカルソート）で、入次数 0 の科目を 1 学期目とし、その学期の科目の出辺を消して入次数が 0 になった科目を次の学期にする。取り出せた科目数 < N なら閉路で -1
    weight: 3
  - id: tp4
    text: 閉路が一部だけにある、同じ前提関係の重複（入次数も重複込みで数えれば整合する）、M=0 なら S=1 で c_1=N、10^5 の鎖で再帰 DFS が落ちる、を列挙する
    weight: 1
  - id: tp5
    text: 2×10^5 個の整数をまとめて読み、各学期の科目数は join して 1 回で出す。サンプル以外に「一部だけに閉路がある入力」を自作して -1 になるか試す
    weight: 1
requirements:
  - id: correct_output
    label: 最短学期数 S と、各科目を最も早い学期に履修したときの各学期の科目数を出力する
  - id: cycle_detection
    label: 前提関係のどこかに循環があれば -1 を出力する（循環が一部だけでも）
  - id: duplicates_and_empty
    label: 同じ前提関係の重複と、前提関係が 1 つも無い場合（M=0）を正しく扱う
  - id: within_limit
    label: N=M=10^5（10^5 科目の鎖を含む）で、再帰の深さ制限に掛からず制限時間内に終わる
rubric_hints:
  correctness: "hidden-trap-partial-cycle（一部の閉路）・hidden-trap-duplicate-edges・hidden-trap-deep-chain（再帰の深さ）・hidden-max-*（TLE）が通れば合格"
  explanation: "「学期 = その科目へ至る最長の前提の鎖の長さ」と言い換え、Kahn 法の段がそれに一致する理由と、閉路の判定（取り出せた数 < N）を説明できれば加点"
  time_management: "10 分で Kahn 法の段ごとの処理を宣言し、25 分以内に入力例 1・2 が通る。残りでエッジケースを自作する"
  red_flags:
    - "再帰 DFS（メモ化した最長路）で書き、10^5 科目の鎖で Python の RecursionError / Node のスタック溢れになる"
    - "隣接リストを set にして重複辺を消したのに、入次数は重複込みで数え、入次数が 0 にならずに -1 と誤判定する"
    - "計算量を言わずに、学期ごとに全科目を見直すループを書き始める"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: トポロジカルソート（段ごとの Kahn 法）と閉路検出 / 題材: 大学の履修計画）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues:
    - "類題の可能性: 前提科目つきの最短学期数はトポロジカルソートの定番題材。各学期の科目数も出力させ、重複辺と一部だけの閉路を隠しテストで突く形にした"
---

## 問題文

ある大学には N 個の科目（1〜N 番）があり、M 個の前提関係が決まっています。j 番目の前提関係は「科目 u_j を修了した次の学期以降でないと、科目 v_j を履修できない」という意味です。同じ前提関係が何度も書かれていることがあります。

1 学期には、前提科目をすべて前の学期までに修了している科目なら、いくつでも同時に履修できます。履修した科目はその学期のうちに修了します。

すべての科目を修了するのに必要な最短の学期数 S を求めてください。さらに、どの科目もそれぞれ履修できる最も早い学期に履修したとき、各学期に履修する科目の数を求めてください。前提関係が循環していて、修了できない科目がある場合は -1 を出力してください。

## 制約

入力:

```
N M
u_1 v_1
⋮
u_M v_M
```

出力: すべて修了できる場合は 2 行（最後に改行を付ける）

```
S
c_1 c_2 … c_S
```

c_k は k 学期目に履修する科目の数。修了できない科目がある場合は `-1` の 1 行。

- 1 ≤ N ≤ 10^5
- 0 ≤ M ≤ 10^5
- 1 ≤ u_j, v_j ≤ N、u_j ≠ v_j
- 入力はすべて整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
5 4
1 2
1 3
3 4
2 4
```

出力例 1:

```
3
2 2 1
```

入力例 2:

```
3 3
1 2
2 3
3 1
```

出力例 2:

```
-1
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「前提関係が無い科目はいつ取れますか」→ 1 学期目。入力例 1 の科目 5 がそれ（1 学期目は科目 1 と 5 の 2 つ）。
  - 「M = 0 はありますか」→ ある。そのとき S = 1、c_1 = N。
  - 「循環が一部の科目だけにあるときは」→ 修了できない科目があるので、全体として -1。
  - 「1 学期に取れる科目数に上限はありますか」→ ない。
- 見たいこと: 「各科目の学期 = その科目へ至る前提の鎖の最長の長さ」と言い換え、トポロジカルソートに結び付けられるか。
- ヒントの出し順:
  1. 「1 学期目に取れる科目は、グラフで言うとどういう頂点ですか」（入次数 0）
  2. 「1 学期目の科目を全部取り除くと、2 学期目に取れる科目はどう見つかりますか。毎回全科目を見直さずに済む方法は」
  3. 「最後まで取り出せなかった科目が残るのは、どういうときですか」（閉路）
- 再帰 DFS で書き始めたら: 「10^5 科目が 1 本の鎖になっていたら、再帰は何段になりますか」と聞く。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 前提関係を有向辺 u → v として隣接リストと入次数を作ります。入次数 0 の科目をすべて「1 学期目」の列に入れ、その学期の各科目の出辺をたどって入次数を 1 ずつ減らし、0 になった科目を「次の学期」の列に入れます。これを列が空になるまで繰り返すと、各段の長さが c_k、段の数が S です（段ごとの Kahn 法）。取り出した科目の合計が N 未満なら、入次数が 0 にならない科目、つまり閉路（またはその先）があるので -1 です。各辺を 1 回ずつしか見ないので O(N + M) です。

重複した辺は、隣接リストにも入次数にも同じ回数だけ入れれば、減らす回数も同じになるので正しく動きます。

**素朴解が落ちる理由**: 学期ごとに全科目を見直して「前提がすべて修了済みの科目」を取る方法は、1 学期あたり O(N + M) を S 回行います。S は鎖なら 10^5 になり、O(S × (N + M)) ≈ 2×10^10 で TLE です（hidden-max-layered-dag は S = 3000、hidden-max-cycle-at-end は約 10^5 段進んでから -1 と分かる）。各科目の学期を「前提科目の学期の最大 + 1」として再帰（メモ化）で求める方法は O(N + M) ですが、10^5 段の鎖で再帰が深くなり、Python（既定の上限 1000）や Node（約 1 万段）で落ちます。

**別解**: 1 列のキュー（BFS）で Kahn 法を行い、`sem[v] = max(sem[v], sem[u] + 1)` を辺ごとに更新しても同じ答えになります。再帰 DFS を使うなら、明示的なスタックで書き直し、訪問中（灰色）の頂点に戻ったら閉路と判定します。

**言語別の注意**:
- Python: `sys.setrecursionlimit` を上げても C スタックが溢れて落ちることがある。再帰は使わない。入力は `sys.stdin.buffer.read().split()` で一度に読む。
- TypeScript: 再帰は 1 万段程度で `RangeError`。隣接リストは CSR 形式（`Int32Array` の head/next）にすると速い。
- C: 隣接リストは「辺の配列＋各頂点の先頭（CSR）」か、`next` 配列による連結リストで持つ。
- Go / Rust: 再帰は深くても動くことが多いが、Kahn 法なら気にしなくてよい。出力は `bufio.Writer` / `BufWriter` でまとめる。
