---
id: dbg-0002
slug: user-loader-async-race
title: ユーザーローダーの非同期競合を直す
category: DBG
tier: core
difficulty: L3
time_limit: 30
languages: [python, typescript]
tags:
  company_style: [pixiv]
  nfr: [cache]
  security: []
  talk_focus: [failure_mode, testing, tradeoff]
interviewer_mode: silent
web_search: false
allow_questions: true
starter_files:
  - path: loader.py
    language: python
    content_ref: starter/python/loader.py
  - path: loader.ts
    language: typescript
    content_ref: starter/typescript/loader.ts
talking_points:
  - id: tp1
    text: cache.has を見てから await するまでの間に同じ id の load が入るので、結果ではなく進行中の Promise / Task をキャッシュして共有する
    weight: 3
  - id: tp2
    text: Promise をキャッシュすると失敗した Promise も残り続けるので、reject されたらその id のエントリを削除して次回は再取得させる
    weight: 3
  - id: tp3
    text: forEach(async ...) や ensure_future を待たずに return しているので、Promise.all / asyncio.gather で全件を待ち入力順に返す
    weight: 3
  - id: tp4
    text: 再現テストでは fetcher の遅延を id ごとに変えて完了順を入れ替え、呼び出し回数を数えて重複取得を検出する
    weight: 2
  - id: tp5
    text: 実運用では DataLoader のように同じ tick の id をまとめて 1 回のバッチ API にする発展があると触れる
    weight: 1
requirements:
  - id: dedupe_concurrent
    label: 同じユーザーを同時に何回要求しても、取得処理は 1 回しか走らない
  - id: cache
    label: 一度取得したユーザーは再取得しない（clear するまで）
  - id: retry_after_failure
    label: 取得に失敗したユーザーは失敗を覚え続けず、次の要求で取り直す
  - id: load_many
    label: 複数ユーザーの一括取得は、全員分そろってから入力と同じ順番で返す
  - id: load_many_failure
    label: 一括取得で 1 人でも失敗したら、一括取得全体が失敗として返る
rubric_hints:
  correctness: "dedupe_concurrent と load_many が通れば合格ライン。retry_after_failure は修正で新たに生まれるバグなので、気づけば大きく加点"
  explanation: "なぜ二重取得が起きるのかを『チェックと設定の間に await がある』と説明できるか。tp2 を修正の副作用として自分から指摘できるか"
  time_management: "10 分以内に 3 つの症状のうち 2 つを再現していること"
  red_flags:
    - "ロックやフラグを sleep で待つポーリングで解決しようとする"
    - "Promise をキャッシュしたが、失敗時の削除を入れていない"
    - "loadMany を逐次 await のループに直して並列性を失い、その理由を説明しない"
  checklist: []
reference_solutions:
  python: solutions/python/loader.py
  typescript: solutions/typescript/loader.ts
source:
  origin: "04 §2.2 DBG 代表例（競合状態・非同期の取りこぼし）を元に手書き"
  license: internal
review:
  reviewed_by: llm
  reviewed_at: 2026-10-24
  known_issues:
    - "clear() を取得中に呼んだ場合の扱い（古い結果で上書きされない保証）はテストしていない。発展の論点として面接官メモに記載"
---

## 問題文

作品一覧ページで、作者の情報を表示するために `UserLoader` を使っています。最近、次の問題が報告されました。

1. 同じ作者の作品が 20 件並ぶと、ユーザー API が 20 回呼ばれている（キャッシュしているはずなのに）。
2. `load_many` で取った作者一覧が、ときどき空だったり順番がばらばらだったりする。
3. ユーザー API が一瞬落ちたあと、その作者だけずっと表示されなくなった、という報告もあります（修正の仕方によっては起きる、と前任者のメモにあります）。

`loader.py`（TypeScript は `loader.ts`）を直してください。何が起きているかを説明しながら進めてください。

## 制約

- `UserLoader(fetcher)`: `fetcher(id)` はユーザーを返す非同期関数（Python はコルーチン関数、TypeScript は Promise を返す関数）。失敗すると例外 / reject。
- `load(id)`: そのユーザーを返す。`load_many(ids)`（TypeScript は `loadMany`）: 入力と同じ順番の配列。重複 id があればその位置にも同じユーザーを入れる。1 人でも失敗したら全体が失敗。
- `clear(id)`: その id のキャッシュを捨てる。
- クラス名・メソッド名・引数は変えない。標準ライブラリのみ。
- 設問者への質問は OK。Web 検索は不可。

## 面接官メモ（非公開）

- 最初に 3 つの症状を別々の原因として切り分けられるかを見る。1 つ目と 3 つ目は「修正と副作用」の関係。
- 想定質問と答え:
  - 「なぜ 20 回呼ばれる？」→ 20 個の load が同時に `cache.has` を見て全部 false、全員が fetch する。チェックと設定の間に await がある。
  - 「どう直す？」→ 結果ではなく進行中の Promise をキャッシュ。2 人目以降は同じ Promise を待つ。
  - 「失敗したら？」→ reject した Promise が残ると永遠に失敗を返す。catch で削除。
  - 「loadMany は逐次でも良い？」→ 正しいが遅い。Promise.all で並列に、順番は配列の位置で保たれる。
  - 「取得中に clear されたら？」→ 古い取得の完了で消したはずのキャッシュが戻らないよう、完了時に自分がまだ登録されているか確認する（発展）。
- ヒントの出し順: (1) 「load を 2 回同時に呼ぶと、2 回目が cache を見る時点で 1 回目は終わっていますか」 (2) 「forEach は async 関数の戻り値を待ちますか」 (3) 「キャッシュに入れたものが失敗だったら、次の呼び出しはどうなりますか」

## 振り返り用解説（終了後のみ表示）

**想定解答**: キャッシュの値を「ユーザー」から「ユーザーを返す Promise（Python は Task）」に変える。`load` は Map に無ければ `fetcher(id)` を呼んで Promise を登録し、`.catch` で「まだ自分が登録されていれば削除」してから再 throw する。あれば同じ Promise を返す。`loadMany` は `Promise.all(ids.map((id) => this.load(id)))`（Python は `asyncio.gather(*(self.load(i) for i in ids))`）にする。どちらも結果の順番は入力の位置で決まり、完了順には依存しない。

**別解 A: 結果キャッシュと進行中マップを分ける**。`cache: Map<id, User>` と `inflight: Map<id, Promise<User>>` を別に持ち、成功したら cache へ移して inflight から消す、失敗したら inflight から消すだけ。状態が増えるが「キャッシュにあるのは常に成功した値」と言えるので、TTL や容量制限（LRU）を後から足しやすい。

**別解 B: DataLoader 型のバッチ**。同じイベントループの tick 内に来た id を集め、`queueMicrotask` / `asyncio.sleep(0)` の後で `fetchMany(ids)` を 1 回だけ呼ぶ。N+1 の API 呼び出しを 1 回にでき、作品一覧のような画面では効果が大きい。ただし API 側にバッチ取得が必要で、部分失敗の扱い（1 人だけ見つからない）を決める必要がある。
