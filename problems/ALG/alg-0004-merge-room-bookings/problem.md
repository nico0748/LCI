---
id: alg-0004
slug: merge-room-bookings
title: 会議室予約の重なりを統合
category: ALG
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, requirements_clarify]
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
    text: 開始時刻でソートしてから先頭から 1 回なめれば統合できるので、全体は O(N log N)
    weight: 3
  - id: tp2
    text: 統合中の区間の終了は max(現在の終了, 次の終了) で更新する（中に完全に含まれる予約で終了が縮まないように）
    weight: 2
  - id: tp3
    text: 半開区間 [s, e) なので、終了と開始が等しい予約（e == s'）は連続利用として 1 つにまとめる、と境界を確認する
    weight: 2
  - id: tp4
    text: 入力が開始時刻順とは限らないこと、全ペアを比べる O(N^2) では N=2×10^5 に間に合わないこと
    weight: 1
requirements:
  - id: merge
    label: 重なる予約を 1 つの区間にまとめる
  - id: touch
    label: 終了と開始が同じ時刻の予約も 1 つにまとめる
  - id: order
    label: 統合後の区間を開始時刻の昇順で出力する
  - id: fast
    label: N = 2×10^5 でも制限時間内に答える
rubric_hints:
  correctness: "全ケース AC で合格。contained（内包）と touching（接する）の 2 種の境界を両方通すこと"
  explanation: "ソートで O(N log N) になる理由と、終了を max で更新する理由を説明できるか。区間の境界（半開区間）を自分から確認すれば加点"
  time_management: "8 分で方針と境界の確認、15 分で動くコード、残りでテスト"
  red_flags:
    - "終了を max でなく次の予約の終了で上書きして、内包された予約で区間を縮めてしまう"
    - "全ペア比較の O(N^2)"
    - "ソートせずに入力順のまま統合する"
  checklist: []
reference_solutions:
  python: solutions/python/main.py
  typescript: solutions/typescript/main.ts
source:
  origin: "LCI オリジナル（会議室予約システムの利用状況表示を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

社内の会議室予約システムで「この部屋が実際に使われている時間帯」を表示したいです。予約が N 件あり、i 件目は時刻 s_i から e_i までの半開区間 [s_i, e_i) です。重なっている予約、および終了と次の開始がちょうど同じ時刻でつながっている予約を 1 つの区間にまとめ、まとめた後の区間を開始時刻の昇順に出力してください。

## 制約

入力:

```
N
s_1 e_1
…
s_N e_N
```

出力: 1 行目に統合後の区間の数 M、続く M 行に各区間の開始と終了を空白区切りで、開始時刻の昇順に出力。

- 1 ≤ N ≤ 2×10^5
- 0 ≤ s_i < e_i ≤ 10^9、すべて整数。入力は開始時刻順とは限らない
- 制限時間 2 秒（Python は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します
- 設問者への質問は OK。Web 検索は不可。

入力例:

```
4
9 12
1 3
2 5
5 6
```

出力例:

```
2
1 6
9 12
```

（[1,3) と [2,5) が重なり、[5,6) は 5 でつながるので [1,6) にまとまる）

## 面接官メモ（非公開）

- 定番の区間マージ。暗記で書ける人が多いので、境界を自分から確認するか、内包ケースを自分でテストするかを見る。
- 想定質問と答え:
  - 「[1,3) と [3,5) はまとめますか？」→ まとめる（部屋は続けて使われている）。
  - 「入力はソート済みですか？」→ いいえ。
  - 「同じ予約が重複して入っていることは？」→ あり得る。
- ヒントの出し順: (1) 「並び順が決まっていると楽になりませんか」 (2) 「[1,10) の後に [2,3) が来たら、終了はいくつになりますか」
- 余裕があれば口頭の追加質問: 「営業時間 [L, R) の中で一番長い空き時間は？」（統合後の区間の隙間を見ればよい）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 予約を (開始, 終了) でソートし、現在の区間 [cs, ce) を持って先頭から見る。次の予約の開始 s が s ≤ ce なら重なる（またはつながる）ので `ce = max(ce, e)`、そうでなければ現在の区間を確定して新しい区間を始める。O(N log N) 時間・O(N) メモリ。

よくある誤りは `ce = e` と上書きすること。[1,10) の後に [2,3) が来ると区間が [1,3) に縮んでしまう。また `s < ce` と書くと [1,3) と [3,5) がまとまらない。

**別解 A: イベント（差分）方式**。開始に +1、終了に −1 のイベントを作って時刻順に並べ、同時刻は +1 を先に処理しながら「使用中の数」が 0→1 になる時刻と 1→0 になる時刻を拾う。同時に何部屋使われているか（最大の重なり数）も同じ走査で求められるので、「会議室が最低何部屋要るか」という派生問題にそのまま使える。

**別解 B: 時刻の範囲が小さい場合のいもす法**。時刻が 0〜1440（分）程度なら配列に差分を書いて累積するだけでよい。今回は 10^9 なので座標圧縮が要る。
