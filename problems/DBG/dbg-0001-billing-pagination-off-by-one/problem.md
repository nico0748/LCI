---
id: dbg-0001
slug: billing-pagination-off-by-one
title: 請求明細ページングの off-by-one 修正
category: DBG
tier: core
difficulty: L1
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [m3]
  nfr: [pagination]
  security: []
  talk_focus: [requirements_clarify, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: billing.py
    language: python
    content_ref: starter/python/billing.py
  - path: billing.ts
    language: typescript
    content_ref: starter/typescript/billing.ts
talking_points:
  - id: tp1
    text: 直す前に「最後のページが出ない」「月末が漏れる」を再現する境界値（0 件・per_page ちょうど・per_page+1 件）を挙げる
    weight: 3
  - id: tp2
    text: total_pages は切り捨ての len // per_page ではなく切り上げにし、0 件でも 1 ページとする
    weight: 2
  - id: tp3
    text: page は 1 始まりなので開始位置は (page - 1) * per_page、スライスの終端は排他的なので start + per_page
    weight: 3
  - id: tp4
    text: has_next は page < total_pages、期間の絞り込みは両端を含むので <= で比較する
    weight: 2
  - id: tp5
    text: 範囲外の page を黙って空ページにせず ValueError にするかは仕様の確認事項として質問する
    weight: 1
requirements:
  - id: all_items_shown
    label: どの件数でも、全ページをたどるとすべての明細がちょうど 1 回ずつ表示される
  - id: total_pages
    label: 総ページ数が正しく、明細が 0 件でも 1 ページとして表示できる
  - id: has_next
    label: 最後のページでは「次へ」が無効になり、それ以外では有効になる
  - id: period_inclusive
    label: 期間指定で開始日と終了日ちょうどの明細も含まれる
  - id: invalid_page
    label: 存在しないページ番号を指定すると拒否される
rubric_hints:
  correctness: "all_items_shown と period_inclusive が通れば合格ライン"
  explanation: "コードを読む前に症状から仮説を立て、境界値で再現してから直したか（tp1）。一つ直すごとに何が変わったかを言えれば加点"
  time_management: "5 分以内に最初のバグを特定し、残りはテストで確かめながら直していること"
  red_flags:
    - "症状を再現せずに思いつきで書き換えている"
    - "直したあとに境界値（0 件、ちょうど割り切れる件数）を試していない"
    - "バグを 1 つ見つけたところで終わり、他の境界を確認しない"
  checklist: []
reference_solutions:
  python: solutions/python/billing.py
  typescript: solutions/typescript/billing.ts
source:
  origin: "04 §2.2 DBG 代表例（off-by-one）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "starter には意図的に 5 箇所の誤り（切り捨て、開始位置、終端、has_next、期間の両端）と範囲外 page の検査漏れがある"
---

## 問題文

医療機関向けの請求明細画面に、次の 2 つの問い合わせが来ています。

1. 「明細が 40 件のとき、2 ページ目に何も出ない。最後の明細が見られない」
2. 「4 月分で絞り込むと、4/1 と 4/30 の明細が出てこない」

`billing.py`（TypeScript は `billing.ts`）の `paginate` と `items_in_period` が原因のようです。コメントに書かれた仕様が正しく、実装が間違っています。原因を特定して直してください。

どう調べているかを話しながら進めてください。直す前に、どんな入力で再現するかを先に言ってもらえると助かります。

## 制約

- 仕様はスターターコードのドキュメントコメントのとおり。関数名・引数・戻り値の形は変えない。
- Python: `paginate(items, page, per_page=20)`、`items_in_period(items, start, end)`（日付は `datetime.date`）。
- TypeScript: `paginate(items, page, perPage = 20)`、`itemsInPeriod(items, start, end)`（日付は `YYYY-MM-DD` 文字列）。戻り値のキーは `items, page, totalPages, hasNext`。
- 範囲外の page は Python は `ValueError`、TypeScript は `RangeError` を投げる。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初の数分で「症状 → 仮説 → 再現する入力」の順に話せるかを見る。いきなりコードを書き換え始めたら、何も言わずに見守る（後で red_flag）。
- 想定される気づきの順: total_pages の切り捨て（40 件・per_page 20 なら 2 で一見正しいが、41 件で 2 になる）→ 開始位置が 1 ページずれる → 終端で 1 件欠ける → has_next → 期間の両端。
- 想定質問と答え:
  - 「0 件のとき total_pages は？」→ 1（空のページを表示する）。
  - 「範囲外の page は？」→ 拒否（ValueError / RangeError）。
  - 「per_page が 0 以下は？」→ 今回は考えなくてよい（呼び出し側で固定値）。
- ヒントの出し順: (1) 「1 ページ目に表示されている明細は何件目から何件目ですか」 (2) 「`items[0:19]` には何件入りますか」 (3) 「4/1 の明細は `start < billed_on` を満たしますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: 5 箇所を直す。`total_pages = max(1, ceil(len(items) / per_page))`（または `(n + per_page - 1) // per_page`）、範囲外の page を拒否、`start = (page - 1) * per_page`、`end = start + per_page`、`has_next = page < total_pages`、期間は `start <= billed_on <= end`。進め方としては、問い合わせ 1 を「40 件・per_page 20・page 2」で再現 → 開始位置のずれに気づく → 直すと今度は 19 件しか出ない → 終端に気づく、という具合に、1 つ直すたびにテストで確かめるのが理想。

**別解 A: テストを先に書く（特性テスト）**。直す前に「全ページを連結すると元の配列と一致する」という性質テストを件数 0〜100 で回すと、どの境界が壊れているかが一度に見える。個別のバグを目で探すより速く、直した後の回帰も防げる。

**別解 B: オフセットと件数を返す API に変える**。page 番号から位置を計算する責務を呼び出し側に寄せ、`paginate(items, offset, limit)` にする方法もある。計算箇所が減ってバグの温床は減るが、既存の画面と URL（`?page=2`）を変える必要があるため、今回の「直してほしい」という依頼に対しては範囲外の提案として口頭で触れる程度がよい。
