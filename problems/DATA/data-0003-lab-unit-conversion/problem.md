---
id: data-0003
slug: lab-unit-conversion
title: 検査値の単位換算テーブル
category: DATA
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript]
tags:
  company_style: [m3]
  nfr: [validation, i18n]
  security: []
  talk_focus: [requirements_clarify, tradeoff, testing]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: units.py
    language: python
    content_ref: starter/python/units.py
  - path: units.ts
    language: typescript
    content_ref: starter/typescript/units.ts
talking_points:
  - id: tp1
    text: 換算を if 文の連鎖でなく、検査項目ごとの単位→(係数 a, 切片 b) のテーブルにして基準単位を経由させる
    weight: 3
  - id: tp2
    text: HbA1c の NGSP % と IFCC mmol/mol や ℃ と ℉ は比例ではなく一次式（切片あり）なので、係数だけの表では表せない
    weight: 3
  - id: tp3
    text: 単位表記は NFKC 正規化と小文字化で吸収し、µ（マイクロ記号）と μ（ギリシャ文字）や ℃ を同一視する
    weight: 2
  - id: tp4
    text: Python の round は偶数丸め（130.5 → 130）なので、四捨五入は Decimal の ROUND_HALF_UP などで明示的に行う
    weight: 2
  - id: tp5
    text: 知らない検査項目や単位は推測で換算せずエラーにする（取り違えは臨床判断を誤らせる）
    weight: 1
requirements:
  - id: convert
    label: 表にある検査項目について、単位どうしを相互に換算できる
  - id: affine
    label: 比例でない換算（HbA1c、体温）も正しく換算できる
  - id: unit_variants
    label: 大文字小文字・全角・記号の違いがある単位表記を同じ単位として扱う
  - id: rounding
    label: 換算後の値を単位ごとに決めた桁数で四捨五入する
  - id: unknown
    label: 表に無い検査項目・単位、数値でない値はエラーにする
rubric_hints:
  correctness: "convert と affine のテストが通れば合格ライン。rounding のちょうど .5 のケースは加点"
  explanation: "tp1 のテーブル化を最初に宣言できたか。tp2 の『比例でない換算がある』に表を見て自分で気づけたら大きく加点"
  time_management: "10 分時点でグルコースの mg/dL ↔ mmol/L が動いていること"
  red_flags:
    - "検査項目×単位の組合せごとに if 文を書き、組合せが増えると破綻する"
    - "HbA1c を係数だけで換算している"
    - "round() の偶数丸めに触れずに使っている"
    - "未知の単位を 1 倍として素通しする"
  checklist: []
reference_solutions:
  python: solutions/python/units.py
  typescript: solutions/typescript/units.ts
source:
  origin: "04 §2.2 DATA 代表例（単位換算）を元に手書き。換算係数は一般的な臨床換算値（グルコース 18、クレアチニン 88.4、総コレステロール 38.67、HbA1c は IFCC = (NGSP − 2.15) × 10.929）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "グルコースの係数は 18.0 を採用（18.016 を使う施設もある）。施設ごとの係数差は面接の論点として残している"
---

## 問題文

複数の検査会社から届く検査結果を、院内の基準単位にそろえて表示したいです。検査会社によって単位が違い、書き方もばらばらです（`mg/dl`、`ＭＧ／ＤＬ`、`µmol/L`、`umol/L`、`℃` など）。

`convert(test, value, from_unit, to_unit)` を作ってください。換算後の値は、換算先の単位ごとに決めた桁数で四捨五入して返します。表に無い検査項目や単位はエラーにしてください。

換算表は制約のとおりです。検査項目はこれから増えます。表をどう持つかを説明しながら書いてください。

## 制約

- 検査項目と単位（括弧内は四捨五入の小数桁数）:
  - `glucose`: `mg/dL`(0) / `mmol/L`(1)。mg/dL = mmol/L × 18.0
  - `creatinine`: `mg/dL`(2) / `μmol/L`(0)。μmol/L = mg/dL × 88.4
  - `cholesterol`: `mg/dL`(0) / `mmol/L`(2)。mmol/L = mg/dL ÷ 38.67
  - `hba1c`: `%`(1) / `mmol/mol`(0)。mmol/mol = (% − 2.15) × 10.929
  - `body_temp`: `°C`(1) / `°F`(1)。°F = °C × 9 / 5 + 32
- 単位は NFKC 正規化・空白除去・大文字小文字無視で比べる。`umol/L` は `μmol/L` の別表記。
- 四捨五入は 0.5 を絶対値の大きい側へ（130.5 → 131、-0.25 → -0.3）。
- 未知の検査項目・単位、有限の数でない値は Python は `ValueError`、TypeScript は `Error`。同じ単位どうしは丸めだけ行う。
- Python は `units.py`、TypeScript は `units.ts`（`convert(test, value, fromUnit, toUnit)`）。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に表を眺めて「全部が掛け算ではない」ことに気づくかを見る（HbA1c と体温）。
- 想定質問と答え:
  - 「どういうデータ構造にする？」→ 検査項目ごとに `単位 → (a, b)`（基準単位 = 値 × a + b）。換算は 元 → 基準 → 先。組合せ数の if を書かない。
  - 「項目が 100 個に増えたら？」→ 表（JSON や DB）に追い出す。コードは変えない。
  - 「`µ` と `μ` は？」→ 見た目は同じで別の文字。NFKC で µ（U+00B5）は μ（U+03BC）になる。
  - 「round で良い？」→ Python は偶数丸め。仕様が四捨五入なら Decimal。浮動小数点の 1.005 問題にも触れられると良い。
  - 「知らない単位は？」→ 素通しせずエラー。取り違えは臨床的に危険。
- ヒントの出し順: (1) 「HbA1c が 0% のとき mmol/mol はいくつですか」 (2) 「検査項目が増えたらどこを書き換えますか」 (3) 「`round(130.5)` は Python でいくつになりますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: `TABLE = {"glucose": {"mg/dl": (1, 0, 0), "mmol/l": (18.0, 0, 1)}, "hba1c": {"%": (1, 0, 1), "mmol/mol": (1/10.929, 2.15, 0)}, …}` のように「基準単位 = 値 × a + b」と丸め桁数を持つ。`norm_unit(u) = NFKC(u)` → 空白除去 → 小文字化 → 別名表（`umol/l` → `μmol/l`）。`convert` は `base = value * a_from + b_from`、`result = (base - b_to) / a_to`、最後に `Decimal(repr(result)).quantize(Decimal(10) ** -digits, ROUND_HALF_UP)`。`repr` を経由するのは、2 進浮動小数点の誤差（130.49999…）を最短の 10 進表現に戻してから丸めるため。

**別解 A: 有理数で持つ**。`fractions.Fraction` で係数を持ち、最後にだけ丸める。浮動小数点誤差が消えるので丸めが安定するが、TypeScript には標準の有理数型が無く、bigint で分子分母を持つ自作が必要になる。

**別解 B: 換算グラフにする**。単位を頂点、換算式を辺にして、直接の換算が無い単位どうしも経路をたどって換算する（例: mg/dL → mmol/L → mol/L）。単位系が大きいときに表が小さくなるが、経路によって丸め誤差が変わる・循環があると不整合が起きるので、医療用途では「基準単位を 1 つ決めて星形にする」本問の方式の方が監査しやすい。
