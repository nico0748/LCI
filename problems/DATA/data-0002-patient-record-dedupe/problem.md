---
id: data-0002
slug: patient-record-dedupe
title: 患者レコードの名寄せ（カナ正規化）
category: DATA
tier: core
difficulty: L3
time_limit: 30
languages: [python, typescript]
tags:
  company_style: [m3]
  nfr: [validation, i18n]
  security: []
  talk_focus: [requirements_clarify, tradeoff, failure_mode]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: dedupe.py
    language: python
    content_ref: starter/python/dedupe.py
  - path: dedupe.ts
    language: typescript
    content_ref: starter/typescript/dedupe.ts
talking_points:
  - id: tp1
    text: NFKC で半角カナを全角にし（ﾀﾞ の濁点も合成される）、ひらがなはコードポイントを 0x60 ずらしてカタカナにそろえる
    weight: 3
  - id: tp2
    text: 正規化した (カナ氏名, 生年月日) を辞書のキーにしてグループ化し、全組合せの比較 O(n^2) を避ける
    weight: 2
  - id: tp3
    text: 生年月日は 1990/1/2 や 1990年1月2日 を ISO 形式にそろえ、存在しない日付は名寄せ対象から外して invalid に回す
    weight: 2
  - id: tp4
    text: 電話番号が食い違うグループは自動で統合せず review として人の確認に回す（誤統合は医療事故につながる）
    weight: 3
  - id: tp5
    text: 小さい ァ と ア、ヴ と ブ のような違いまで同一視するかは誤統合とのトレードオフなので、今回は同一視しないと決める
    weight: 1
requirements:
  - id: normalize_name
    label: 全角・半角・ひらがな・空白の違いだけのカナ氏名を同じ人として扱う
  - id: normalize_date
    label: 書式の違う生年月日を同じ日付として扱う
  - id: merge
    label: 氏名と生年月日が一致し、電話番号が矛盾しないレコード群を統合候補として返す
  - id: review
    label: 氏名と生年月日が一致しても電話番号が食い違うレコード群は、統合せず要確認として返す
  - id: invalid
    label: 生年月日が読めない・氏名が空のレコードを名寄せから外して報告する
  - id: order
    label: 結果の並びが入力順に依存せず決まる
rubric_hints:
  correctness: "normalize_name と merge/review の区別が通れば合格ライン"
  explanation: "tp4（誤統合のコスト）を自分から言えるか。『名寄せは自動化しすぎない』という業務判断を説明できれば大きく加点"
  time_management: "15 分時点でカナ正規化とグループ化が動いていること。日付の書式ゆれは後半でもよい"
  red_flags:
    - "全レコードの組を二重ループで比較している"
    - "電話番号が違っても統合している"
    - "正規化で ァ→ア のように別の文字まで潰している理由を説明しない"
  checklist: []
reference_solutions:
  python: solutions/python/dedupe.py
  typescript: solutions/typescript/dedupe.ts
source:
  origin: "04 §2.2 DATA 代表例（重複患者レコードの名寄せ）を元に手書き。M3 型は仮定"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "和暦（H2.1.2 など）は対象外として invalid に回す仕様にしている。実務では元号変換が要る"
    - "長音記号の揺れ（ー/－/-）は正規化しない。誤統合の危険と天秤にかけて決める論点として残している"
---

## 問題文

複数の病院のシステムを統合することになり、患者マスタに同じ人が別レコードで登録されていないかを調べたいです。

各レコードは `{id, name_kana, birth_date, phone}` です。入力した人によって、カナ氏名は全角だったり半角だったりひらがなだったり、空白の入れ方がばらばらです。生年月日の書き方もそろっていません。電話番号は空のこともあります。

`find_duplicates(records)` は、自動で統合してよい候補（`merge`）と、人が確認すべき候補（`review`）、そもそも判定できないレコード（`invalid`）を返してください。間違って別人を統合すると困る、という前提で進めてください。

## 制約

- 同一人物候補: 正規化したカナ氏名と生年月日が一致するレコード群（2 件以上）。その中で空でない電話番号（数字だけ取り出したもの）が 2 種類以上あれば `review`、そうでなければ `merge`。
- カナ正規化: NFKC → ひらがな（U+3041〜U+3096）をカタカナに → 空白と `・` を除く。それ以外の文字は変えない。
- 生年月日: `YYYY-MM-DD`、`YYYY/M/D`、`YYYY年M月D日` を受け付ける（数字は全角も可）。読めない・存在しない日付、または正規化後の氏名が空なら `invalid`。
- 戻り値: `{"merge": [[id, ...]], "review": [[id, ...]], "invalid": [id, ...]}`。各グループ内の id は昇順、グループは先頭の id の昇順、`invalid` も昇順（文字列比較）。
- Python は `dedupe.py`、TypeScript は `dedupe.ts`（`findDuplicates`）。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に「誤統合（別人をくっつける）と統合漏れ、どちらが重いか」を確認してくるかを見る。聞かれたら「誤統合が圧倒的に重い」と答える。
- 想定質問と答え:
  - 「半角カナは？」→ NFKC で全角に。ﾀﾞ（タ＋半角濁点）も ダ に合成される。
  - 「ひらがなは？」→ 0x60 ずらす。NFKC ではカタカナにならない。
  - 「ァ と ア は同じにする？」→ しない（今回は）。同一視すると誤統合が増える。
  - 「電話番号が片方だけ空なら？」→ 矛盾ではないので merge。両方あって違えば review。
  - 「1 万件でも大丈夫？」→ キーで辞書に入れるので O(n)。二重ループは O(n^2)。
  - 「キーが 1 文字違いの人は？」→ 今回は対象外。実務では編集距離などで review 候補を広げる（別解）。
- ヒントの出し順: (1) 「`ﾔﾏﾀﾞ` と `ヤマダ` を同じにするには？」 (2) 「全組合せを比べると 1 万件で何回比較しますか」 (3) 「同じ名前と誕生日で電話番号が違ったら、本当に同じ人ですか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: `normalize_kana(s)`: `unicodedata.normalize("NFKC", s)` → 各文字が `ぁ`〜`ゖ` なら `chr(ord(c) + 0x60)` → 空白（`str.isspace`）と `・` を除去。`normalize_date(s)`: NFKC で全角数字を半角にしてから 3 つの正規表現のどれかに当て、`datetime.date(y, m, d)` が作れれば ISO 文字列。レコードごとにキー `(kana, date)` を作り、作れなければ `invalid`。`dict[key] -> list[record]` に集め、2 件以上のグループについて `{digits(phone)} - {""}` の要素数で merge / review を振り分け、最後に決められた順に並べる。

**別解 A: Union-Find で複数キーを組み合わせる**。「(氏名, 生年月日) が一致」または「(電話番号, 生年月日) が一致」のように複数の一致条件をつなぐなら、条件ごとにキーで辞書化し、同じキーに入ったレコード同士を Union-Find で結合する。推移的に大きなグループができやすいので、グループ内の矛盾チェック（review 行き）がより重要になる。

**別解 B: スコアリングで確率的に判定する**。氏名の編集距離、生年月日の一致、電話番号・住所の一致に重みを付けて合計点を出し、高い閾値以上を merge、中間を review にする（Fellegi–Sunter 型のレコードリンケージ）。表記ゆれや入力ミスに強い一方、閾値の調整と説明責任が必要で、30 分の面接では「こういう発展がある」と言えれば十分。
