---
id: data-0001
slug: visit-log-daily-aggregation
title: 受付ログ CSV の日別集計（タイムゾーン）
category: DATA
tier: core
difficulty: L2
time_limit: 30
languages: [python, typescript]
tags:
  company_style: [m3]
  nfr: [timezone, validation]
  security: []
  talk_focus: [requirements_clarify, failure_mode, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: visits.py
    language: python
    content_ref: starter/python/visits.py
  - path: visits.ts
    language: typescript
    content_ref: starter/typescript/visits.ts
talking_points:
  - id: tp1
    text: visited_at を UTC の瞬間として解釈してから Asia/Tokyo（UTC+9）の日付に直し、UTC の日付のまま集計しない
    weight: 3
  - id: tp2
    text: オフセットの無い時刻はどのタイムゾーンか分からないので推測せず missing_timezone としてエラーに回す
    weight: 2
  - id: tp3
    text: 引用符付きフィールドのカンマを split(',') で壊さないよう csv モジュール（RFC 4180）で読み、BOM と CRLF を吸収する
    weight: 2
  - id: tp4
    text: 列はヘッダ名で引き、不正な行は処理全体を止めず行番号と理由を errors に積んで残りを集計する
    weight: 2
  - id: tp5
    text: 再送で重複した visit_id は 1 回だけ数え、実人数は (日付, 診療科) ごとの patient_id の集合の大きさで出す
    weight: 2
requirements:
  - id: jst_date
    label: 受付時刻を日本時間の日付で集計する（UTC で日付をまたぐ受付が正しい日に入る）
  - id: counts
    label: 日付×診療科ごとに受付件数と実人数（重複しない患者数）を出す
  - id: csv_format
    label: 引用符付きのフィールド・BOM・CRLF・列順の入れ替えに対応する
  - id: errors
    label: 不正な行は行番号と理由付きで報告し、それ以外の行は集計される
  - id: duplicates
    label: 同じ受付 ID が複数回出てきても 1 回として数える
  - id: order
    label: 結果は日付の昇順、同じ日付なら診療科名の順に並ぶ
rubric_hints:
  correctness: "jst_date と counts のテストが通れば合格ライン"
  explanation: "tp1 を最初の 3 分で言語化できたか（UTC 15:00 以降が翌日になる）。tp2 の『推測しない』判断を理由付きで言えれば加点"
  time_management: "15 分時点で正常行だけの集計が JST で動いていること。エラー行の分類は後半でよいと宣言できれば可"
  red_flags:
    - "visited_at の先頭 10 文字を日付として使っている（UTC の日付になる）"
    - "line.split(',') で CSV を分割している"
    - "例外 1 つでファイル全体の処理を止めている"
    - "サーバーのローカルタイムゾーンに依存した変換をしている"
  checklist: []
reference_solutions:
  python: solutions/python/visits.py
  typescript: solutions/typescript/visits.ts
source:
  origin: "04 §2.2 DATA 代表例（CSV 取込と集計、日付・タイムゾーン）を元に手書き。M3 型は仮定"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "M3 の実際の出題形式は未入手（04 §1 の仮定）。題材は医療系 Web の業務データ処理として想定したもの"
    - "日本は夏時間が無いので UTC+9 固定で正しい。夏時間のある地域への拡張は data の別問題で扱う"
---

## 問題文

複数のクリニックの受付システムから、受付ログが CSV で毎日送られてきます。本部向けに「日付×診療科ごとの受付件数と実人数」を出す集計を作ってください。

- 受付時刻はシステムごとに UTC だったり日本時間だったり海外拠点の時刻だったりしますが、オフセット付きで書かれています。集計は日本時間の日付で行います。
- CSV は Excel で開いて保存し直されることがあり、きれいなデータとは限りません。不正な行があっても処理は止めず、どの行がなぜ駄目だったかを返してください。
- 同じログが再送されて、同じ受付が二重に入っていることがあります。

`aggregate_visits(csv_text)` を作ってください。データのどこが危ないかを説明しながら進めてください。

## 制約

- 列: `visit_id, patient_id, department, visited_at`（順番は入れ替わることがある。ヘッダ行は必ずある）。RFC 4180 形式で、フィールド内に改行は無い。
- `visited_at`: `YYYY-MM-DDTHH:MM:SS` に `Z` か `±HH:MM` が付いた形式。日本時間は UTC+9 固定。
- 戻り値: `{"rows": [{"date": "YYYY-MM-DD", "department", "visits", "patients"}], "errors": [{"line", "reason"}]}`。`rows` は日付昇順、同日は診療科名のコードポイント順。`errors` は行番号順（ヘッダが 1 行目）。
- `reason`: `column_count`（列数違い）、`missing_field`（空の項目がある）、`missing_timezone`、`invalid_timestamp`、`duplicate_visit_id`（2 回目以降）。
- 必要な列がヘッダに無ければ例外（Python `ValueError`、TypeScript `Error`）。空行は無視する。
- Python は `visits.py`、TypeScript は `visits.ts`（`aggregateVisits`）。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初の 3 分で「どのタイムゾーンの日付で数えるか」を確認してくるかを見る。聞かれたら「日本時間」と答える。
- 想定質問と答え:
  - 「オフセットが無い時刻は？」→ 推測しない。missing_timezone。サーバーのローカル時刻で解釈すると環境で結果が変わる。
  - 「CSV は split で良い？」→ 診療科名に `"小児科（夜間, 休日）"` のようなカンマ入りがある。csv モジュール。
  - 「BOM って？」→ Excel が UTF-8 で保存すると先頭に付ける。付いたままだと 1 列目のヘッダ名が一致しない。
  - 「重複は？」→ visit_id で判定。後から来たものを duplicate_visit_id として報告し、集計からは外す。
  - 「エラー行が大量なら？」→ 件数の上限や割合で取込自体を失敗扱いにする閾値を設けるのが実務的。
- ヒントの出し順: (1) 「`2026-03-31T15:00:00Z` は日本では何日ですか」 (2) 「診療科名にカンマが入っていたら？」 (3) 「この CSV を Excel で保存し直すと先頭に何が付きますか」
- 30 分で全部は難しいので、正常系の集計 → JST → エラー分類 → 重複 の優先順位を宣言できればよい。

## 振り返り用解説（終了後のみ表示）

**想定解答**: 先頭の BOM（`﻿`）を除いて `csv.reader(io.StringIO(text))` で読む。ヘッダから列名→位置の辞書を作り、必要な 4 列が無ければ例外。各行について、空行は飛ばし、列数違い→空項目→時刻の形式（正規表現でオフセットの有無を分けてから `datetime.fromisoformat`）→ visit_id の重複、の順に検査してエラーなら `errors` に積んで次へ。正常なら `(dt.astimezone(JST).date(), department)` をキーに件数と `set(patient_id)` を更新する。最後にキーでソートして `rows` を作る。

**別解 A: 一度すべてを UTC に正規化した中間表を作る**。取込（検証・正規化）と集計を分け、検証済みの行を `{visit_id, patient_id, department, visited_at_utc}` として保存してから集計する。日本時間以外の日付での集計や再集計が簡単になり、取込エラーと集計ロジックを別々にテストできる。データ量が多い実務ではこちらが基本。

**別解 B: SQL で集計する**。検証済みの行を SQLite などに入れ、`date(visited_at_utc, '+9 hours')` で日付を出して `GROUP BY date, department` と `COUNT(DISTINCT patient_id)` で集計する。集計の正しさを SQL に任せられ、条件が増えても書き換えやすい。ただし CSV の検証と行番号付きのエラー報告はアプリ側に残る。
