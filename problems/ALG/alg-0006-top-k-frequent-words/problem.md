---
id: alg-0006
slug: top-k-frequent-words
title: ログから頻出ワード上位 K 件
category: ALG
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [generic]
  nfr: []
  security: []
  talk_focus: [complexity, requirements_clarify, tradeoffs]
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
    text: 出現回数はハッシュマップ（dict / Map）で 1 回なめて数えるので O(N)
    weight: 2
  - id: tp2
    text: 同じ回数のワードは辞書順で並べるという同点の規則を、ソートの比較キー（回数の降順、ワードの昇順）に入れる
    weight: 3
  - id: tp3
    text: 種類数 U をすべてソートすると O(U log U)、K が小さければサイズ K のヒープで O(U log K) にできる
    weight: 2
  - id: tp4
    text: 種類数が K より少ないときは、ある分だけを出力するという境界を確認する
    weight: 1
  - id: tp5
    text: ログがメモリに載らないほど大きい場合は、分割して数えてから合算する、近似（Count-Min Sketch など）を使う、といった拡張を話せる
    weight: 1
requirements:
  - id: count
    label: ワードごとの出現回数を数える
  - id: order
    label: 回数の多い順、同じ回数は辞書順で並べる
  - id: topk
    label: 上位 K 件（種類が K 未満ならすべて）を出力する
  - id: fast
    label: N = 2×10^5 でも制限時間内に答える
rubric_hints:
  correctness: "全ケース AC で合格。同点のケースを落とすなら比較キーの誤り"
  explanation: "ソートとヒープの計算量の違いと、どちらを選ぶかの理由を説明できるか。同点の扱いを自分から確認すれば加点"
  time_management: "5 分で要件（同点・K が大きい場合）を確認、12 分で動くコード、残りで同点のテスト"
  red_flags:
    - "Counter.most_common(k) をそのまま使い、同点が出現順になる"
    - "TypeScript で sort に比較関数を渡さない、または localeCompare に頼って順序が環境依存になることに気づかない"
    - "ワードごとに list.count を呼んで O(N^2) になる"
  checklist: []
reference_solutions:
  python: solutions/python/main.py
  typescript: solutions/typescript/main.ts
source:
  origin: "LCI オリジナル（検索ログの急上昇ワード集計を題材にした手書き）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

検索ログから「よく検索されたワード」の上位 K 件を表示したいです。ログには N 個のワードが記録されています。出現回数の多い順に上位 K 件を、ワードと回数の組で出力してください。回数が同じワードは辞書順（文字コードの昇順）で前にあるものを先にします。ワードの種類が K 未満なら、ある分をすべて出力します。

## 制約

入力:

```
N K
w_1 w_2 … w_N
```

出力: 1 行に 1 件ずつ「ワード 回数」を空白区切りで、上の順序で出力。

- 1 ≤ K ≤ N ≤ 2×10^5
- 各ワードは英小文字 a–z のみからなる 1〜20 文字
- 制限時間 2 秒（Python は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します
- 設問者への質問は OK。Web 検索は不可。

入力例:

```
8 3
cat dog cat bird dog ant cat ant
```

出力例:

```
cat 3
ant 2
dog 2
```

（ant と dog は 2 回で同点なので、辞書順で ant が先）

## 面接官メモ（非公開）

- 数えるだけなら簡単なので、同点の規則と K の境界を自分で確認するか、ソートとヒープの使い分けを語れるかを見る。
- 想定質問と答え:
  - 「同点は？」→ 辞書順（文字コード順）。
  - 「K が種類数より大きいときは？」→ ある分だけ出す。
  - 「大文字や記号は？」→ 今回は来ない。実務なら正規化（小文字化、NFKC）を先にやる、という話は加点。
- ヒントの出し順: (1) 「並べ替えの基準を 2 つ持つには、何を比べればいいですか」 (2) 「上位 K 件だけ欲しいとき、全部並べる必要はありますか」
- 余裕があれば口頭の追加質問: 「1 日 10 億件のログならどうしますか」（tp5）。

## 振り返り用解説（終了後のみ表示）

**想定解答**: dict（Map）で回数を数え、(−回数, ワード) をキーにソートして先頭 K 件を出す。O(N + U log U)（U は種類数）。

Python の `Counter.most_common(k)` は同点を「最初に出てきた順」で返すので、この問題の同点規則にはそのままでは合わない。TypeScript の `localeCompare` はロケールによって順序が変わりうるので、文字コード順なら `a < b ? -1 : a > b ? 1 : 0` で比べる。

**別解 A: サイズ K のヒープ**。`heapq.nsmallest(k, counts.items(), key=lambda x: (-x[1], x[0]))` のように、K 件だけを保つと O(U log K)。K が U よりずっと小さいときに速く、メモリも K 件分で済む。

**別解 B: バケット**。回数は 1〜N なので、回数ごとのバケットにワードを入れ、多い回数から辞書順に取り出す。バケット内のソートは要るが、回数方向のソートは O(N) になる。

**大規模な場合**: ログを分割して各部分で数え、ワードのハッシュで振り分けて合算する（MapReduce）。厳密さが要らなければ Count-Min Sketch と上位 K 件のヒープを組み合わせて、メモリを一定に抑えられる。
