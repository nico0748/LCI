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

## リポジトリ構成

```
apps/web               Next.js 16（UI と API）
packages/core          スキーマ（問題・セッション・評価）、タイムライン再構成、指標計算、セッション保存
packages/runner        Docker ウォームコンテナ実行と stdio/unit 判定
packages/evaluator     finalize（ffmpeg・whisper・指標・キーフレーム）と Claude 評価
packages/mcp-server    Claude Desktop / Claude Code 向け MCP サーバ
packages/problem-tools 問題の検証・統計・雛形生成・参照解セルフテスト
problems/              問題バンク（problems/<カテゴリ>/<id>-<slug>/）、_catalog/ に 500 問の分類と種
docker/                言語別 Dockerfile
data/                  セッションデータ（git 管理外）
```

## 問題バンクの現状

- 分類と目標数は 9 カテゴリ合計 500 問（`problems/_catalog/targets.json`）、種リスト 500 件（`seeds.json`）
- 実装済みは 27 問（FE 7 / ALG 7 / BE 4 / SEC 4 / DATA 3 / DBG 2）。すべて参照解がテストを通り、スターターは落ちることを確認済み
- **全問 `reviewed_by: llm`（人手レビュー前）**。読んで問題ないと判断したら `review.reviewed_by: human` に変える。`pnpm problems:validate` が未レビューを警告で出す
- DATA カテゴリは M3 の試験内容が未入手のため「業務データ処理」の仮定で作っている

```sh
pnpm problems:validate   # スキーマ・言語宣言・文字数などのゲート
pnpm problems:stats      # 目標 500 問に対する進捗
pnpm problems:selftest   # 参照解とスターターを実際に実行して検証（ローカルの python3/node 等を使用）
pnpm --filter @lci/problem-tools new FE my-slug   # 種から雛形を作る
```

## テスト

```sh
pnpm test        # 全パッケージの node:test
pnpm typecheck
```
