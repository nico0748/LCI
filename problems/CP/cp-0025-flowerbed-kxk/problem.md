---
id: cp-0025
slug: flowerbed-kxk
title: "花壇の K×K 区画"
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
    text: "H = W = 1000、K = 500 のとき、区画ごとに足し直すと何回の計算になりますか"
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
    text: "H, W ≤ 1000 で区画の位置は最大 10^6 通り。1 区画を O(1) で求めれば全体 O(HW) = 10^6 回で、Python でも間に合うと宣言する"
    weight: 3
  - id: tp2
    text: "区画ごとに K^2 マスを足し直す素朴解は (H−K+1)(W−K+1)K^2、K = 500 で 501^2 × 500^2 ≈ 6.3×10^10 回になり TLE と言う"
    weight: 2
  - id: tp3
    text: "2 次元累積和 S[i][j]（上 i 行・左 j 列の合計、0 の行と列を足した (H+1)×(W+1)）を作り、区画の合計を S[r+K][c+K] − S[r][c+K] − S[r+K][c] + S[r][c] で出す"
    weight: 3
  - id: tp4
    text: "同点は上の行 → 左の列の順なので、行優先で走査して「より大きいときだけ」更新する。全部 0、K = H = W、最大が右下の隅（ループ上限 H−K の取りこぼし）を確かめる"
    weight: 1
  - id: tp5
    text: "盤面は空白なしの数字列なので 1 文字ずつ数字に直す。合計は最大 9×10^6 で int に収まる。サンプル 2（3 区画が同点）を手で追う"
    weight: 1
requirements:
  - id: correct_output
    label: "合計が最大の K×K 区画について、1 行目に合計、2 行目に左上の行番号と列番号（1 始まり）を出力する"
  - id: tie_break
    label: "合計が最大の区画が複数あるときは、左上が最も上の行、その中で最も左の列のものを選ぶ"
  - id: boundary
    label: "K = H = W（区画が 1 つ）や、最大の区画が右下の隅にある場合も正しく扱う"
  - id: within_limit
    label: "H = W = 1000、K = 500 でも制限時間内に終わる"
rubric_hints:
  correctness: "hidden-max-k500 / hidden-max-gradient で素朴解が TLE、hidden-trap-tie-row-first（列優先の走査）・hidden-trap-all-zero（初期値と位置の更新）・hidden-trap-bottom-right（添字の 1 ずれ）で WA が出やすい"
  explanation: "2 次元累積和の式と、0 の行・列を付ける理由（境界の場合分けを無くす）を説明できれば加点。素朴解の 6.3×10^10 回と比べられるとよい"
  time_management: "8 分以内に 2 次元累積和の方針を宣言、20 分以内にサンプル 3 件が通る、残りで全部 0 と右下の隅を試す"
  red_flags:
    - "計算量を見積もらずに、区画ごとに K×K の二重ループで足し直す"
    - "最大値の初期値を 0 にして「より大きいとき更新」とし、全部 0 の盤面で位置が未設定のまま出力する"
    - "累積和の添字を 1 ずらす（S を H×W で作って r−1 を参照し、1 行目・1 列目の区画で範囲外）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: 2 次元累積和 / 題材: 公園の花壇から記念撮影用の K×K 区画を選ぶ。同点は上・左を優先）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

公園に、H 行 W 列のマスに区切られた花壇があります。上から i 行目、左から j 列目のマスには、花が G_{i,j} 本咲いています（0〜9 本）。

この花壇から K 行 K 列の正方形の区画を 1 つ選び、記念撮影をします。区画に含まれる花の本数の合計が最大になる区画を選び、その合計と、区画の左上のマスの位置を求めてください。

合計が最大になる区画が複数あるときは、左上のマスが最も上の行にあるものを選び、それも複数あるときは最も左の列にあるものを選んでください。

## 制約

入力:

```
H W K
G_1
G_2
…
G_H
```

G_i は i 行目の花の本数を左から並べた、長さ W の数字の列です（空白で区切られていません）。

出力: 1 行目に合計の最大値、2 行目に区画の左上のマスの行番号と列番号（どちらも 1 始まり）を空白区切りで出力する（最後に改行を付ける）。

- 1 ≤ H, W ≤ 1000
- 1 ≤ K ≤ min(H, W)
- G_i は `0`〜`9` からなる長さ W の文字列
- H, W, K は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
3 4 2
1203
0450
9101
```

出力例 1:

```
14
2 1
```

入力例 2:

```
3 3 2
090
000
009
```

出力例 2:

```
9
1 1
```

合計 9 の区画は左上が (1, 1)・(1, 2)・(2, 2) の 3 つで、最も上・最も左の (1, 1) を選びます。

入力例 3:

```
2 2 2
12
34
```

出力例 3:

```
10
1 1
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「区画は盤面からはみ出してよい？」→ だめ。左上は 1〜H−K+1 行、1〜W−K+1 列。
  - 「同点の優先は行と列のどちらが先？」→ 行（上）が先。入力例 2 で確かめられる。
  - 「数字は空白区切り？」→ 空白なしの文字列。1 文字ずつ数字に直す。
  - 「合計は 32bit に収まる？」→ 最大 9 × 10^6 なので収まる。
- ヒントの出し順:
  1. 「1 次元なら、区間の和を O(1) で出す方法は何でしたか」（累積和）
  2. 「それを 2 次元にすると、左上からの長方形の和 S[i][j] で区画の和はどう表せますか」（包除: 右下 − 上 − 左 + 左上）
  3. 「同点のとき上・左を残すには、どの順で走査して、どの比較で更新しますか」（行優先、`>` のときだけ更新）
- 1 次元のスライド（行ごとに K 列の和 → 縦に K 行の和）でも O(HW) になる。説明できれば同等に評価する。

## 振り返り用解説（終了後のみ表示）

**想定解答**: (H+1)×(W+1) の配列 S を 0 で用意し、`S[i+1][j+1] = S[i][j+1] + S[i+1][j] − S[i][j] + G[i][j]` で 2 次元累積和を作ります（S[i][j] は上 i 行・左 j 列の長方形の合計）。左上が (r, c)（0 始まり）の区画の合計は `S[r+K][c+K] − S[r][c+K] − S[r+K][c] + S[r][c]` です。r を 0..H−K、c を 0..W−K の順（行優先）で回し、合計が**それまでの最大より大きいときだけ**更新すると、同点のときは上・左が残ります。時間 O(HW)、空間 O(HW)。

**素朴解が落ちる理由**: 区画ごとに K×K マスを足すと (H−K+1)(W−K+1)K^2 回で、H = W = 1000、K = 500 のとき約 6.3×10^10 回になります（hidden-max-k500。C でも TLE）。K が小さいと速いので、小さいケースだけ試すと気づけません。

**別解**: 縦方向の K 行の和を列ごとに尺取りで更新し、その行の上で横方向の K 列の和をさらに尺取りで求める方法も O(HW) です。メモリは O(W) で済みます。

**言語別の注意**:
- 全言語: 初期値を −1（または最初の区画の値）にする。0 にして `>` で更新すると、全部 0 の盤面（hidden-trap-all-zero）で位置が入らない。
- C: S は `static int S[1001][1001]`（約 4MB。関数内に置くとスタックを溢れやすい）。行は `scanf("%s")` で読める。
- Go/Rust: 1 行をバイト列として読み、`b - '0'` で数字にする。
- TypeScript: `Int32Array((H+1)*(W+1))` の 1 次元配列にすると速い。`charCodeAt(j) - 48` で数字にする。
- Python: 10^6 回の二重ループは 1 秒前後かかる。行ごとに内包表記と `max` / `list.index` を使うと速い（`index` は最初の位置を返すので左優先になる）。
- PHP: 2 次元配列より、行ごとの配列（`array_fill`）を作って使い回すと速い。`ord($s[$j]) - 48` で数字にする。
