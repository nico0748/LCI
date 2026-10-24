# LCI — Live Coding Interview trainer

説明しながらコーディングするライブコーディング面接を、Mac 上でひとりで練習・振り返りするローカル Web アプリ。
要件・設計は `docs/requirements/00_overview.md` から読むこと（決定ログ D1–D15 が正）。

## 構成（pnpm workspace）
- `apps/web` Next.js 16 (App Router, Turbopack, Tailwind v4) — UI と Route Handlers
- `packages/core` zod スキーマ（問題・セッション・評価）、問題ローダ、タイムライン再構成、指標計算、ファイルベースの SessionStore
- `packages/runner` Docker ウォームコンテナ実行 + stdio/unit 判定
- `packages/evaluator` 文字起こし (whisper.cpp) 連携、Anthropic API 評価、キーフレーム抽出
- `packages/mcp-server` Claude Desktop / Claude Code 向け MCP サーバ（evaluator/core を共有）
- `packages/problem-tools` 問題の検証・生成・参照解テスト CLI
- `problems/<CAT>/<id>-<slug>/problem.md + tests.json (+ starter/, solutions/, tests/)`
- `docker/` 言語別 Dockerfile と compose
- `data/` セッションデータ（gitignore）

## 規約
- TypeScript strict。`packages/*` は `.ts` を直接 import（`allowImportingTsExtensions`）。Node 22 の `--experimental-strip-types` で実行。
- テストは `node:test`。各 package の `pnpm test`。
- UI テキストは日本語。コメントも日本語で、なぜそうするかを書く。
- 時刻はすべてセッション時計 `t`（ms, performance.now 基準）。壁時計は `*_wall` に限定。
- 指標は決定的に計算し、LLM には解釈だけさせる（03 §2.3）。
- 「7 言語対応」をメタデータだけで宣言しない。`languages` は参照解とテストが実在する言語のみ。
- セッション中の UI にアニメーション・通知を置かない（04 §7）。
