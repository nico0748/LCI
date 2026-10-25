# LCI — ライブコーディング面接トレーナー

説明しながらコードを書く「ライブコーディング面接」を、Mac 上でひとりで練習して振り返るためのローカル Web アプリ。

- 問題を選んで開始すると、カメラ＋マイク（任意で自タブ画面）を録画し、エディタの編集を全件ログする
- 終了後に whisper.cpp で日本語を文字起こしし、「いつ・何を話しながら・コードのどこを触っていたか」を 1 本のタイムラインにする
- 説明先行秒数・沈黙・無発話編集・方針変更・実行回数などの指標はアプリが決定的に計算する
- Claude（アプリ内の Anthropic API、または Claude Desktop / Claude Code から MCP 経由）が面接官ルーブリック 8 軸で時刻付きフィードバックを返す
- C / Rust / Python / Go / TypeScript / PHP は言語別 Docker コンテナで、HTML/CSS/JS はサンドボックス iframe で実行・自動判定する（Pixiv 型の「サーバーに優しいか」はリクエスト数で判定）

設計の経緯と決定事項は [docs/requirements/00_overview.md](docs/requirements/00_overview.md) を参照。

## クイックスタート

```sh
pnpm install          # Node 22 以上 / pnpm 10。postinstall で Monaco をローカル配信用にコピーする
pnpm dev              # http://localhost:3000
```

これだけで、問題一覧・HTML 問題（fe-xxxx）のセッション・録画・判定・レビュー画面が動く。以下は機能ごとの追加セットアップ。

| 機能 | 必要なもの | 手順 |
|---|---|---|
| C/Rust/Python/Go/TS/PHP の実行・判定 | Docker Desktop または OrbStack | `pnpm runner:build` → `pnpm runner:warm` → `pnpm runner:bench 20`。詳細は [docker/README.md](docker/README.md) |
| 文字起こし・キーフレーム | ffmpeg, whisper.cpp, ggml-large-v3-turbo | [docs/setup-mac.md](docs/setup-mac.md) |
| アプリ内の Claude 評価 | `ANTHROPIC_API_KEY` | `cp apps/web/.env.example apps/web/.env.local` して記入 |
| Claude Desktop / Claude Code から評価 | MCP サーバ `lci` | [packages/mcp-server/README.md](packages/mcp-server/README.md) |

足りないものがあっても録画と保存は止まらない。ffmpeg / whisper が無ければ文字起こしは `skipped`、Docker が無ければ実行ボタンが案内に置き換わる。

## 使い方の流れ

1. `/problems` で問題を選ぶ（カテゴリ・難易度・時間・言語で絞り込み、`/` で検索、`j`/`k`/Enter）
2. 事前確認（カメラ・マイク・Docker）→「開始」1 回で t=0（画面録画を使うときと再開時だけ、面接画面でもう一度押す）。制限時間は問題ごと（15/20/30/45 分）。面接画面は幅 1280px 以上が必要
3. セッション中: ⌘/Ctrl+Enter 実行、+Shift で判定、⌘/Ctrl+Shift+E 終了、⌘/Ctrl+K → ? でショートカット一覧。採点結果の詳細はセッション中には出さない
4. 終了すると自動で文字起こし・指標計算 → `/sessions/<id>` のレビュー画面へ
5. レビュー画面: 総評 → 次の練習 → 要件チェック・軸別スコアの順に読み、下の作業領域で動画・文字起こし・その時点のコード・指摘が 1 本の時刻で同期する（Space 再生、←/→ ±5 秒、j/k 指摘移動）。参照解と解説はここで初めて開示

画面右上で 自動/ライト/ダーク を切り替えられる。デザインの方針と部品は [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md)、`/design` がスタイルガイド

## 模範解答デモを作る（Claude Desktop / Claude Code）

問題ごとに「どの順で、何を話しながら書くか」を見せる模範解答デモ（ナレーション＋タイプ演出＋実行、動画ではない）を、MCP 経由で Claude に作らせる。

1. MCP サーバ `lci` を登録する（[packages/mcp-server/README.md](packages/mcp-server/README.md)）
2. Claude Desktop ならプロンプト `author_demo` を選んで `problem_id`（例 `alg-0001`）と `language`（例 `python`）を入れる。Claude Code なら `/mcp__lci__author_demo alg-0001 python`
3. Claude が `get_problem_for_demo` → `validate_demo_script`（直して再検証）→ `save_demo_script` と進め、`/problems/<id>/demo?lang=…&demo=…` の URL を返す。アプリでその URL を開くと再生できる

- 台本の各 run と最終コードは保存時に **Docker で実際に実行して** 結果を記録する（Docker が要る。再生には要らない）。web 問題（fe-xxxx）は v1.1 まで作れない
- 音声は macOS の `say` と ffmpeg が要る（`brew install ffmpeg`）。無ければ字幕だけで再生する。声は `LCI_TTS_VOICE`（既定 `Kyoko`）、速さは `LCI_TTS_RATE`。日本語の声の一覧は `pnpm --filter @lci/demo voices`
- 録画中はデモの作成・再生 API が止まる（録画のディスクと CPU を奪わないため）
- 台本の書き方は `lci://guides/demo-authoring`（`packages/demo/src/guide.ts`）、決定事項は [docs/requirements/demo/00_decisions.md](docs/requirements/demo/00_decisions.md)

## リポジトリ構成

```
apps/web               Next.js 16（UI と API）
packages/core          スキーマ（問題・セッション・評価）、タイムライン再構成、指標計算、セッション保存
packages/runner        Docker ウォームコンテナ実行と stdio/unit 判定
packages/evaluator     finalize（ffmpeg・whisper・指標・キーフレーム）と Claude 評価
packages/mcp-server    Claude Desktop / Claude Code 向け MCP サーバ
packages/demo          模範解答デモ（台本の検証・保存・再生用の組み立て・say による音声）
packages/problem-tools 問題の検証・統計・雛形生成・参照解セルフテスト
problems/              問題バンク（problems/<カテゴリ>/<id>-<slug>/）、_catalog/ に 500 問の分類と種
docker/                言語別 Dockerfile
data/                  セッションデータ（git 管理外）
```

## 問題バンクの現状

- 分類と目標数は 10 カテゴリ合計 500 問（`problems/_catalog/targets.json`）、種リスト 500 件（`seeds.json`）
- 最大カテゴリは **CP（競技プログラミング形式、150 問）**。paiza C〜A・AtCoder ABC-C 相当の標準入出力問題で、6 言語（c/rust/python/go/typescript/php）すべてに対応する。cp-0001〜cp-0040 は id・slug・題名を種表に固定済み（`docs/requirements/05_cp_problems.md` §5）
- 実装済みは 27 問（FE 7 / ALG 7 / BE 4 / SEC 4 / DATA 3 / DBG 2）。すべて参照解がテストを通り、スターターは落ちることを確認済み
- **全問 `reviewed_by: llm`（人手レビュー前）**。読んで問題ないと判断したら `review.reviewed_by: human` に変える。`pnpm problems:validate` が未レビューを警告で出す
- DATA カテゴリは M3 の試験内容が未入手のため「業務データ処理」の仮定で作っている

```sh
pnpm problems:validate   # スキーマ・言語宣言・文字数・CP ゲート（6 言語・sample が問題文にあるか・hidden 10 件以上・gen.py・6 MB 以下）
pnpm problems:stats      # 目標 500 問に対する進捗
pnpm problems:selftest   # 参照解とスターターを実際に実行して検証（ローカルの gcc/rustc/python3/go/node/php を使用）
pnpm --filter @lci/problem-tools new FE my-slug          # 種から雛形を作る（採番は自動）
pnpm --filter @lci/problem-tools new --id cp-0003        # id を指定して作る（並列作業で採番が衝突しない。カテゴリは id、slug は種から決まる）
```

`problems:selftest` のオプション（`pnpm problems:selftest --only cp-0001,cp-0002` のように渡す）:

| オプション | 内容 |
|---|---|
| `--only <id,...>` | 対象を絞る。カンマ区切り・複数回指定・接頭辞（`cp-00`、`CP/cp-0003-...` のディレクトリ名も可）。何にも当たらなければ exit 2 |
| `--lang <lang>` | 言語を絞る |
| `--naive` | `gen/naive.*` が hidden-max-* の少なくとも 1 件で TLE することを確かめる（間に合ってしまえば失敗） |
| `--timing` | 参照解が制限の 50% を超えたら警告ではなく FAIL にする（CP の DoD） |
| `--verbose` / `--keep` | 失敗ケースの詳細を出す / 作業ディレクトリを残す |

時間はケースごとに測り、`timeMs ×` 言語倍率（c/rust/go ×1、typescript ×2、python/php ×3）を超えたら FAIL、50% を超えたら警告。
コンパイル・実行コマンドは判定 runner（`packages/runner`）と同じものを使う。表の「最大ms / 制限ms / 比」が最も遅いケースの値。

CP 問題のテストは `gen/gen.py` で生成する（`tests/*.in|*.out` は `.gitattributes` で diff を出さない）。作業の完了条件（DoD）:

```sh
IDS=cp-0003
pnpm problems:validate
python3 problems/CP/cp-0003-*/gen/gen.py --check   # 生成物が最新か・余分なファイルが無いか・brute との突き合わせ
pnpm problems:selftest --only $IDS --naive --timing
```

## テスト

```sh
pnpm test        # 全パッケージの node:test
pnpm typecheck
```
