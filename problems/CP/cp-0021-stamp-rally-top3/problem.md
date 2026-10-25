---
id: cp-0021
slug: stamp-rally-top3
title: "スタンプラリー上位 3 名"
category: CP
tier: core
difficulty: L1
time_limit: 20
languages: [c, rust, python, go, typescript, php]
tags:
  company_style: [paiza]
  nfr: []
  security: []
  talk_focus: [complexity, edge_cases, testing]
interviewer_mode: silent
followups:
  - at_sec: 300
    text: "同じ地点で 2 回押したスタンプと、同点の並びはどう扱いますか"
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
    text: "N ≤ 1000・M ≤ 20 なので計算量は問題にならず、辞書（map）で集計して O(N log N) のソート 1 回で足りると最初に宣言する"
    weight: 3
  - id: tp2
    text: "ログを 1 行ずつ順位付けせず、名前 → 得点の辞書で合算してから並べる（同じ名前が離れた行に現れるため、連続行だけまとめる方法は誤り）"
    weight: 2
  - id: tp3
    text: "重複スタンプは (名前, 地点) の組の集合で 1 回だけ数え、ソートキーは (−得点, 名前) にする（an は ann より先）"
    weight: 3
  - id: tp4
    text: "提出前に、参加者が 3 人未満・3 位が同点で複数・全員同点・N=1 を自作ケースで確かめる"
    weight: 1
  - id: tp5
    text: "出力は「名前 得点」を min(3, 人数) 行。サンプル 3（4 人同点で 3 名に切る）を手で追って確認する"
    weight: 1
requirements:
  - id: correct_ranking
    label: "得点の降順、同点は名前の辞書順（短い方が先）で並べ、上位 3 名を「名前 得点」の形で 1 行ずつ出力する"
  - id: dedupe_stamp
    label: "同じ参加者が同じ地点で押した 2 回目以降のスタンプを得点に数えない"
  - id: merge_name
    label: "同じ名前の行がログ中で離れていても 1 人として合算する"
  - id: fewer_than_three
    label: "参加者が 3 名未満のときは全員だけを出力し、余分な行を出さない"
rubric_hints:
  correctness: "hidden-trap-duplicate-stamp（重複スタンプ）・hidden-trap-tie-at-third（3 位の同点）・hidden-trap-fewer-than-3 が通れば合格ライン。TLE は狙っていない"
  explanation: "辞書で集計 → (−得点, 名前) で整列 → 先頭 min(3, 人数) 件、の 3 段を最初に言えれば加点。重複を集合で除く理由を説明できるとよい"
  time_management: "5 分以内に集計とソートキーの方針を宣言、12 分以内にサンプル 3 件が通る、残りで 3 人未満と同点の自作ケースを試す"
  red_flags:
    - "重複スタンプの規則を読み落とし、ログの点をそのまま足す"
    - "得点だけでソートし、同点の並びが入力順（安定ソート任せ）になる"
    - "参加者が 3 人未満でも 3 回ループして範囲外を読む（C/Go/Rust で異常終了、Python で IndexError）"
  checklist: []
reference_solutions:
  c: solutions/c/main.c
  rust: solutions/rust/main.rs
  python: solutions/python/main.py
  go: solutions/go/main.go
  typescript: solutions/typescript/main.ts
  php: solutions/php/main.php
source:
  origin: "LCI オリジナル（技法: map 集計＋多キーソート / 題材: 商店街のスタンプラリー、地点ごとの重複押印は 1 回分）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-25
  known_issues: []
---

## 問題文

商店街でスタンプラリーが開かれました。チェックポイントは M か所あり、チェックポイント j のスタンプは P_j 点です。参加者がスタンプを押すたびに、参加者の名前とチェックポイントの番号が 1 行ずつ記録され、ログは全部で N 行あります。

参加者の得点は、押したスタンプの点の合計です。ただし、同じ参加者が同じチェックポイントで 2 回以上押しても、そのチェックポイントの点は 1 回分しか数えません。

得点の高い順に上位 3 名の名前と得点を出力してください。得点が同じ参加者どうしは、名前の辞書順で前にある方を上位とします（例: an は ann より前、ann は bob より前）。参加者が 3 名未満のときは、全員を順位の順に出力してください。

## 制約

入力:

```
N M
P_1 P_2 … P_M
S_1 C_1
S_2 C_2
…
S_N C_N
```

S_i C_i は、名前 S_i の参加者がチェックポイント C_i でスタンプを押したことを表します。

出力: 上位の参加者から順に、1 行に 1 名ずつ「名前 得点」を空白区切りで出力する（最後に改行を付ける）。

- 1 ≤ N ≤ 1000
- 1 ≤ M ≤ 20
- 1 ≤ P_j ≤ 100
- 1 ≤ C_i ≤ M
- S_i は英小文字だけからなる 1 文字以上 10 文字以下の文字列
- N, M, P_j, C_i は整数
- 制限時間 2 秒（Python・PHP は ×3、TypeScript は ×2）
- TypeScript は `node --experimental-strip-types` で実行します（型は消すだけで検査しない）
- 設問者への質問は OK。Web 検索は不可。

入力例 1:

```
6 3
10 20 30
hana 1
taro 2
hana 3
ken 1
taro 2
ken 3
```

出力例 1:

```
hana 40
ken 40
taro 20
```

taro はチェックポイント 2 で 2 回押していますが、20 点は 1 回分だけ数えます。hana と ken は同点なので名前の順に並べます。

入力例 2:

```
3 2
5 7
mio 2
mio 2
mio 1
```

出力例 2:

```
mio 12
```

入力例 3:

```
7 2
15 15
ann 1
an 2
bob 1
bob 2
ann 2
cy 1
an 1
```

出力例 3:

```
an 30
ann 30
bob 30
```

## 面接官メモ（非公開）

- 想定される質問と答え:
  - 「同じチェックポイントで 2 回押したら？」→ 2 回目以降は 0 点（問題文のとおり）。
  - 「同点で 3 位が何人もいたら全員出す？」→ 出すのは 3 名まで。名前の辞書順で切る（入力例 3）。
  - 「名前に大文字や空白は？」→ 英小文字だけ。比較はそのまま文字コード順でよい。
  - 「1 行もスタンプを押していない参加者は？」→ ログに出てこない人は参加者として数えない。
- ヒントの出し順:
  1. 「名前ごとの合計を持つ入れ物は何が向いていますか」（辞書 / map）
  2. 「同じ地点を 2 回数えないために、何を覚えておけばよいですか」（(名前, 地点) の集合、または名前ごとの M 個の真偽値）
  3. 「並べ替えのキーを 2 つ言ってください」（得点の降順、名前の昇順。出力は min(3, 人数) 行）
- 見たいこと: 規則（重複・同点・3 名未満）を問題文から自分で拾えるか。サンプル 1 の taro を手で追って重複の規則を確かめているか。

## 振り返り用解説（終了後のみ表示）

**想定解答**: ログを上から読み、(名前, 地点) の組を集合に入れながら、初めての組のときだけ `得点[名前] += P[地点]` とします。最後に (−得点, 名前) の順で並べ、先頭から min(3, 人数) 件を出力します。時間 O(N log N)、空間 O(N)。

**素朴解との比較**: 名前ごとにログ全体を見直して得点を数える O(N²) でも N = 1000 なら 10^6 回で間に合います（L1 なので TLE は狙っていません）。落ちる原因はほぼ規則の読み落としです: 重複スタンプを足す（hidden-trap-duplicate-stamp）、得点だけで並べて同点が入力順になる（hidden-trap-tie-at-third / name-prefix）、3 人未満で 3 行出そうとする（hidden-trap-fewer-than-3）、連続する同名の行だけをまとめる（hidden-trap-merge-same-name）。

**別解**: 名前に通し番号を振り、`got[番号][地点]` の真偽値表で重複を除く方法も同じ計算量です。並べ替えの代わりに「残りの中で最上位を 3 回選ぶ」選択でも O(人数) × 3 で済みます。

**言語別の注意**:
- C: 名前は `char[11]`（10 文字＋終端）。人数は高々 1000 なので構造体配列の線形探索で十分。`qsort` の比較関数は得点の差、同点なら `strcmp`。
- TypeScript: `sort` の比較関数を必ず渡す（`(a, b) => b.s - a.s || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0)`）。`localeCompare` は環境のロケールに依存するので避ける。
- Go: `sort.Slice` の less で 2 キーを比べる。`map` の反復順は毎回変わるので、必ず並べ替えてから出力する。
- Rust: `HashMap<String, i64>` に集計し、`Vec` に移して `sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)))`。
- PHP: `usort` に `$b[1] <=> $a[1] ?: strcmp($a[0], $b[0])`。連想配列のキーは数字だけの文字列だと整数に変わるが、この問題の名前は英小文字だけなので影響しない。
- Python: `sorted(score.items(), key=lambda kv: (-kv[1], kv[0]))[:3]`。スライスは人数が 3 未満でも安全。
