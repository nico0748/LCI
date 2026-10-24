---
id: alg-0007
slug: range-event-count
title: 時刻範囲に入るイベント数（二分探索）
category: ALG
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: main.py
    language: python
    content_ref: starter/python/main.py
  - path: main.ts
    language: typescript
    content_ref: starter/typescript/main.ts
talking_points:
  - id: tp1
    text: 問い合わせごとに全イベントを数える O(NQ) は 4×10^10 回で間に合わないので、先に 1 回ソートしてから二分探索する
    weight: 3
  - id: tp2
    text: 両端を含む [l, r] の個数は「r 以下の個数 − l 未満の個数」、つまり bisect_right(r) − bisect_left(l) で求まる
    weight: 3
  - id: tp3
    text: 同じ時刻のイベントが複数ある場合や、範囲がどのイベントにもかからない場合を境界のテストに入れる
    weight: 1
  - id: tp4
    text: 全体は O((N + Q) log N)。問い合わせを先に全部読めるなら、問い合わせもソートして尺取りで数える方法もある
    weight: 1
  - id: tp5
    text: イベントが後から追加され続ける場合は、ソート済み配列への挿入が O(N) になるので、座標圧縮と BIT（Fenwick 木）などを検討する
    weight: 1
requirements:
  - id: count
    label: 各問い合わせ [l, r] に入るイベントの数を答える
  - id: inclusive
    label: 両端の時刻ちょうどのイベントも数える
  - id: dup
    label: 同じ時刻のイベントをすべて数える
  - id: fast
    label: N, Q = 2×10^5 でも制限時間内に答える
rubric_hints:
  correctness: "全ケース AC で合格。境界ちょうどのケースを落とすなら bisect の左右の取り違え"
  explanation: "ソート + 二分探索で O((N+Q) log N) になる理由と、bisect_left / bisect_right の使い分けを説明できるか"
  time_management: "5 分で方針、12 分で動くコード、残りで境界と重複のテスト"
  red_flags:
    - "問い合わせごとに全イベントをなめる"
    - "二分探索を手書きして、等号の扱いで境界がずれる"
    - "TypeScript で sort に比較関数を渡さず、数値が文字列順に並ぶ"
  checklist: []
reference_solutions:
  python: solutions/python/main.py
  typescript: solutions/typescript/main.ts
source:
  origin: "LCI オリジナル（監査ログの期間検索を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

監査ログの画面で「この期間に何件のイベントがあったか」をすばやく表示したいです。イベントが N 件あり、それぞれの発生時刻（整数）が記録されています。続いて Q 件の問い合わせ [l, r] が来るので、発生時刻 t が l ≤ t ≤ r を満たすイベントの数をそれぞれ答えてください。イベントの時刻はばらばらの順で与えられ、同じ時刻のイベントが複数あることもあります。

## 制約

入力:

```
N Q
t_1 t_2 … t_N
l_1 r_1
…
l_Q r_Q
```

出力: Q 行。j 行目に j 番目の問い合わせの答え。

- 1 ≤ N, Q ≤ 2×10^5
- 0 ≤ t_i ≤ 10^9、0 ≤ l_j ≤ r_j ≤ 10^9、すべて整数
- 制限時間 2 秒（Python は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します
- 設問者への質問は OK。Web 検索は不可。

入力例:

```
6 4
30 10 20 20 50 40
10 20
21 39
0 100
45 45
```

出力例:

```
3
1
6
0
```

## 面接官メモ（非公開）

- 二分探索の境界を正しく扱えるかを見る問題。ライブラリ（bisect / 手書き）のどちらでもよいが、境界の理由を説明させる。
- 想定質問と答え:
  - 「両端は含む？」→ 含む。
  - 「l > r の問い合わせは？」→ 来ない。
  - 「イベントは後から増える？」→ 今回は増えない（増える場合は tp5 の口頭の追加質問に使う）。
- ヒントの出し順: (1) 「時刻が並んでいたら、r 以下のイベントが何件かはどうやって分かりますか」 (2) 「[l, r] の件数を『r 以下』と『l 未満』の 2 つで表すと？」
- TypeScript で `arr.sort()` と書いたら止めずに見守り、テストで気づけるかを見る（数値が文字列として並ぶ）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 時刻をソートし、問い合わせごとに `bisect_right(ts, r) - bisect_left(ts, l)` を答える。ソート O(N log N)、各問い合わせ O(log N)、全体 O((N + Q) log N)。

`bisect_left(ts, x)` は「x 未満の個数」、`bisect_right(ts, x)` は「x 以下の個数」。両端を含む区間なので、上端は right、下端は left を使う。TypeScript には標準の二分探索がないので、「条件を満たす最初の位置」を探す形（`lo < hi` のループで `mid` を判定）に揃えて 1 つ書き、それを `x 未満` と `x 以下` の 2 通りで呼ぶと境界を間違えにくい。

**別解 A: オフライン処理（尺取り）**。問い合わせを先に全部読み、l と r をそれぞれソートしてイベントと一緒に 1 回なめる。二分探索を使わずに O((N + Q) log(N + Q)) で書けるが、答えを元の問い合わせ順に戻す手間がかかる。

**別解 B: イベントが追加され続ける場合**。ソート済み配列への挿入は O(N) なので、時刻を座標圧縮して BIT（Fenwick 木）で「x 以下の件数」を O(log N) で更新・取得する。時刻の範囲が事前に分からないなら平衡二分探索木や SortedList を使う。
