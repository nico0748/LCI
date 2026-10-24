---
id: alg-0002
slug: lru-cache
title: LRU キャッシュ
category: ALG
tier: core
difficulty: L2
time_limit: 20
languages: [python, typescript, go]
tags:
  company_style: [leetcode]
  nfr: [complexity, cache]
  security: []
  talk_focus: [data_structure_choice, complexity]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: lru.py
    language: python
    content_ref: starter/python/lru.py
  - path: lru.ts
    language: typescript
    content_ref: starter/typescript/lru.ts
  - path: lru.go
    language: go
    content_ref: starter/go/lru.go
talking_points:
  - id: tp1
    text: get と put をどちらも O(1) にするにはハッシュマップと双方向リストの組み合わせが要る
    weight: 3
  - id: tp2
    text: get でも「最近使った」扱いにして先頭へ移動する
    weight: 2
  - id: tp3
    text: 既存キーへの put は値の更新と移動であり、容量チェックで追い出さない
    weight: 2
  - id: tp4
    text: 言語標準の順序付き辞書（OrderedDict / Map の挿入順）を使う場合はその計算量の根拠を述べる
    weight: 1
requirements:
  - id: get_put
    label: get(key) は値または -1 を返し、put(key, value) で追加・更新できる
  - id: evict_lru
    label: 容量超過時に最も長く使われていないキーを 1 つ追い出す
  - id: get_refreshes
    label: get による参照も「使用」として扱う
  - id: update_no_evict
    label: 既存キーの更新では他のキーを追い出さない
  - id: o1
    label: get / put が平均 O(1) で動く
rubric_hints:
  correctness: "全ユニットテスト PASS が合格ライン。large-ops が TLE なら O(N) 操作が混じっている"
  explanation: "なぜ配列ではなくリストか、番兵ノードで境界条件を消す、などを言語化できれば加点"
  time_management: "10 分でデータ構造を宣言して get/put の骨格、残りで追い出しと更新"
  red_flags:
    - "list.remove / indexOf で O(N) の移動をしている"
    - "既存キー更新時に容量判定して誤って追い出す"
reference_solutions:
  python: solutions/python/lru.py
  typescript: solutions/typescript/lru.ts
  go: solutions/go/lru.go
source:
  origin: "LCI オリジナル（定番問題のユニットテスト版）"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues: []
---

## 問題文

容量 `capacity` の LRU（Least Recently Used）キャッシュを実装してください。

- `LRUCache(capacity)`: 正の整数 `capacity` で初期化する。
- `get(key)`: キーが存在すれば値を返し、無ければ `-1` を返す。
- `put(key, value)`: キーが存在すれば値を更新し、無ければ追加する。追加によって要素数が `capacity` を超えたら、**最も長い間使われていないキー**を 1 つ削除する。

`get` と `put` はどちらも平均 O(1) で動作させてください。

シグネチャは制約欄を参照してください。

## 制約

言語ごとのシグネチャ:

- Python（`lru.py`）: `class LRUCache: __init__(self, capacity: int)`, `get(self, key: int) -> int`, `put(self, key: int, value: int) -> None`
- TypeScript（`lru.ts`）: `export class LRUCache { constructor(capacity: number); get(key: number): number; put(key: number, value: number): void }`
- Go（`lru.go`, `package lru`）: `func Constructor(capacity int) LRUCache`, `func (c *LRUCache) Get(key int) int`, `func (c *LRUCache) Put(key, value int)`


- 1 ≤ capacity ≤ 3000
- 0 ≤ key ≤ 10^4、0 ≤ value ≤ 10^5
- get / put の呼び出しは合計 2×10^5 回まで
- 「使う」とは get でのヒット、または put（追加・更新）のこと
- TypeScript は `node --experimental-strip-types` で型注釈を消して実行します。`enum`・`namespace`・コンストラクタ引数の `private x` などの変換が必要な構文は使えません

## 面接官メモ（非公開）

- データ構造を宣言する前に「両方 O(1)」の要件を確認するか。
- 番兵（ダミー head/tail）を使うと境界条件が消えることに触れるか。
- Python の OrderedDict（move_to_end / popitem(last=False)）や JS の Map の挿入順を使う解も可。その場合「内部的に双方向リスト相当なので O(1)」と根拠を言えるか。
- 既存キーの put で容量チェックを先にやって誤って追い出すバグが頻出。

## 振り返り用解説（終了後のみ表示）

キー → ノードのハッシュマップと、使用順に並べた双方向連結リスト（先頭が最新）を組み合わせます。

- get: マップで引き、ヒットしたらノードをリスト先頭へ移動して値を返す。
- put: 既存ならノードの値を更新して先頭へ。新規ならノードを先頭に挿入し、要素数が容量を超えたら末尾（最も古い）を削除してマップからも消す。

すべての操作がポインタの付け替えとハッシュ参照だけなので O(1) です。
JS の `Map` は挿入順を保持するので、`delete` → `set` で末尾に移し、`keys().next()` で最古を取る実装でも O(1) になります。
