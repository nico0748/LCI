# LCI（Live Coding Interview trainer）統合設計概要

作成日: 2026-10-24 ／ 対象読者: Nico ／ 状態: 要件確定前ドラフト（4本の個別要件書を統合し、矛盾を解消したもの）

個別要件書:
- [01_capture.md](./01_capture.md) 録画・文字起こし・編集ログ（FR-C）
- [02_execution.md](./02_execution.md) 多言語コード実行サンドボックス（FR-X）
- [03_evaluation.md](./03_evaluation.md) 評価ルーブリックと MCP サーバ（FR-E）
- [04_problems_ux.md](./04_problems_ux.md) 問題バンク（約500問）と画面設計（FR-P / FR-U）

---

## 1. 何を作るか（1段落）

「説明しながらコードを書く」ライブコーディング面接を、Mac 上で一人で再現して練習するためのローカル Web アプリ。問題を選んで開始すると、カメラ＋マイク（任意で自タブ画面）を録画し、Monaco エディタの編集イベントを全件ログし、終了後に whisper.cpp で日本語文字起こしを行う。文字起こしと編集ログを単一の時計で突き合わせて「いつ・何を話しながら・コードのどこを触っていたか」のタイムラインを作り、Claude が面接官ルーブリックに沿って時刻付きのフィードバックを返す。評価はアプリ内（Anthropic API）でも、Claude Desktop / Claude Code から MCP サーバ経由でも行える。

## 2. 確定した方針（決定ログ）

| # | 論点 | 決定 | 根拠（詳細は各要件書） |
|---|---|---|---|
| D1 | 配置 | Mac ローカル起動の Web アプリ。コードは `/Users/yuumaro/LCI`、GitHub の新規リポジトリで PR 管理 | Nico 決定（2026-10-24）。録画を外に出さない |
| D2 | スタック | Next.js（App Router）+ TypeScript + Monaco。サーバ側は Next の Route Handler ＋ Node サイドカー（Docker 制御・whisper 起動） | 01/02/04 |
| D3 | 文字起こし | 確定版はセッション終了後に whisper.cpp large-v3-turbo（Metal）でバッチ処理。ライブ字幕は表示専用の SHOULD。Web Speech API・クラウド STT は不採用 | 01 §4。タイムスタンプ精度と日本語精度を優先 |
| D4 | 録画 | カメラ＋マイクを 1 つの MediaRecorder、2 秒チャンクで即時サーバ保存、終了時 ffmpeg で再 mux。画面録画は自タブ限定の SHOULD | 01。クラッシュ耐性と A/V 同期 |
| D5 | 編集ログ | Monaco の `IModelContentChange` 全件＋60 秒ごとの全文スナップショット＋カーソル。編集箇所の意味づけ（関数名など）は tree-sitter（WASM, Worker）で `focus` イベント化 | 01 §2。キーストロークは IME と相性が悪い |
| D6 | 時刻合わせ | `performance.now()` 基準の単一時計 `t`。録画・文字起こしは `t_rec_start` と線形 `scale` で写像 | 01 §2.5 |
| D7 | コード実行 | C/Rust/Python/Go/TS(Node)/PHP は言語別ウォーム Docker コンテナ＋`docker exec`（network none, 読み取り専用 rootfs, 資源制限）。HTML/CSS/JS とブラウザ TS は `sandbox` iframe（オフライン CSP, fetch/XHR シム, リクエスト計測） | 02 §言語別比較。1.5 秒以内のフィードバックと「ノート PC を壊さない」脅威モデル |
| D8 | 判定方式 | `stdio`（AtCoder 型）・`unit`（各言語標準ツール）・`web`（DOM/レイアウト検証＋操作シナリオ＋リクエスト数）。Pixiv 問題は `web` でそのまま採点可能にする | 02 |
| D9 | 評価の主経路 | アプリ内から Anthropic API（claude-opus-5-5, structured outputs）を呼ぶ。MCP サーバは同じコアライブラリを共有する副経路（対話的レビュー用） | 03 §4。再現性とワンクリック UX |
| D10 | 評価の原則 | 指標（説明先行秒数、15 秒超の沈黙回数、方針変更回数、要件チェック等）はアプリ側で決定的に計算し、Claude は解釈のみ。フィードバックは必ず時刻＋コード範囲＋文字起こし引用を伴う。総合点は目立たせない | 03 §2–3 |
| D11 | 動画の扱い | Claude は動画を直接見られない。編集バーストや沈黙開始など「出来事駆動」で 8–16 枚のキーフレームを画像として渡す。Web カメラ映像は既定で渡さない | 03 §6 |
| D12 | 問題バンク | 10 カテゴリ合計 500 問の分類を定義（2026-10-25 に CP を追加、05 §2）。v1 は人手レビュー済み Core 100 問＋品質ゲート全通過の generated 問題（目標 150）。tier バッジを UI に表示 | 04 §2, §4。LLM 生成 500 問の品質リスクを正面から扱う |
| D13 | 言語の優先順位 | 参照解は TS/JS → Python → Go → PHP → Rust → C の順に整備。v1 で全問題に揃えるのは TS/JS と Python | 04 §10 |
| D14 | 面接官ペルソナ | v1 は Pixiv 型の「無言モード」＋問題ファイル定義の固定テキスト追問のみ。TTS/LLM リアルタイム面接官は v2 | 04 §6。エコーで文字起こしが汚れる |
| D15 | 対応環境 | v1 は macOS + Chrome のみ、Apple Silicon（arm64 イメージ） | 01/02 |

## 3. 全体アーキテクチャ

```
┌──────────────────────────── Browser (Chrome) ─────────────────────────────┐
│ 問題ペイン │ Monaco エディタ │ プレビュー(sandbox iframe) / コンソール      │
│ 録画インジケータ・タイマー・ライブ字幕(任意)                                 │
│ MediaRecorder ──2s chunk──▶  │  Monaco change/cursor/focus(tree-sitter) ─▶ │
└──────────────┬────────────────────────────┬───────────────────────────────┘
               ▼                            ▼
┌──────────────────────── Next.js server (localhost) ───────────────────────┐
│ /api/sessions  録画チャンク追記(.webm.part) / events.jsonl 追記            │
│ /api/run /api/judge  ──▶ runner: docker exec (warm containers ×6)          │
│ /api/transcribe       ──▶ whisper.cpp (large-v3-turbo, Metal)              │
│ /api/evaluate         ──▶ core.metrics → Anthropic API (structured output) │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼
   data/sessions/<id>/ { session.json, events.jsonl, media/, derived/ }
   problems/<category>/<id>/problem.md + tests/ + solutions/
               ▲
┌──────────────┴──────────┐
│ mcp-server (stdio)      │ ◀── Claude Desktop / Claude Code
│ list_sessions, get_transcript, get_edit_log, get_code_snapshot_at,
│ get_problem_reference, save_evaluation, prompt evaluate_session
└─────────────────────────┘
```

### リポジトリ構成（モノレポ, pnpm workspace）

```
LCI/
  apps/web/              Next.js アプリ（UI + Route Handlers）
  packages/core/         セッション・問題・評価の型(zod)、metrics 計算、タイムライン結合
  packages/runner/       Docker ウォームコンテナ管理、judge、診断パーサ
  packages/mcp-server/   MCP サーバ（core を利用）
  packages/problem-tools/ 問題の検証(G1–G6)・生成・参照解テスト CLI
  problems/              問題バンク（カテゴリ/ID ごとのディレクトリ）
  docker/                言語別 Dockerfile ＋ compose
  docs/requirements/     本ドキュメント群
  data/                  セッションデータ（gitignore）
```

## 4. セッションのライフサイクル

1. **準備** 問題選択 → 権限確認（カメラ/マイク）→ Docker 稼働確認 → 同意画面（初回）。
2. **本番** `status: recording`。録画チャンク・イベントは即時永続化。タイマーは 20 分標準＋延長、上限 30 分。
3. **終了** `status: finalizing`。ffmpeg 再 mux → whisper 文字起こし → タイムライン結合 → metrics 計算 → `status: ready`。
4. **評価** アプリ内評価（API）または MCP から。結果は `derived/evaluation-<n>.json` に rubric_version 付きで保存。
5. **レビュー** 動画・文字起こし・コードタイムラインを単一時刻でスクラブ。Claude のピンをタイムライン上に表示。隠しテスト・参照解はここで初めて開示。

## 5. 4 要件書間の整合メモ（解消した矛盾）

- 01 は「MCP へは動画を渡さない既定」、03 は「キーフレーム 8–16 枚を渡す」→ **画面キーフレームは渡す（OFF 可）、Web カメラ映像は渡さない**で統一。
- 02 は「実行結果 JSON をセッションログへ保存」、01 の `events.jsonl` に `run` イベントがある → **`run` イベントに実行結果 ID を持たせ、本体は `derived/runs/` に保存**。
- 04 は言語を TS/JS+Python 先行、02 は 6 イメージ全部を v1 → **Docker イメージは 6 つ作るが、問題側の参照解は TS/JS・Python から**。実行環境と問題整備は切り離す。
- 03 の v1 は MCP の `get_video_frames` を v1.1 送り → **アプリ内評価にはキーフレームを含め、MCP ツールとしての公開は v1.1**。

## 6. 実装フェーズ案

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| P0 骨格 | モノレポ、Next.js、core の zod スキーマ、問題ローダ、Pixiv 問題（fe-0001）投入 | 問題一覧が表示され fe-0001 が開ける |
| P1 セッション | 録画チャンク保存、Monaco 編集ログ、単一時計、sandbox iframe 実行＋fetch シム、`web` 判定 | fe-0001 を 20 分通しで録画・保存・4 シナリオ採点できる |
| P2 Runner | 6 言語 Docker ウォームコンテナ、`stdio`/`unit` 判定、SSE、Monaco マーカー、Docker 未起動 UI | 受け入れ条件（02 §v1）を満たす |
| P3 文字起こし＋評価 | whisper.cpp 連携、タイムライン結合、metrics、Anthropic API 評価、レビュー画面 | fe-0001 のセッションにピン付きフィードバックが出る |
| P4 MCP | mcp-server（7 ツール＋prompt）、Claude Desktop 設定手順 | Claude Desktop からセッション評価ができる |
| P5 問題バンク | Core 100 問の執筆・レビュー、生成パイプライン（G1–G6）、generated 問題投入 | Core 100 が CI で参照解テスト通過、generated サンプル 20 問中 15 問以上が合格 |
| P6 仕上げ | 履歴ダッシュボード、tree-sitter 対応言語追加、ライブ字幕、画面録画 | SHOULD 優先項目 |

## 7. Nico に確認したいこと

1. **M3（エムスリー）の試験内容**: vault に記録がなかった。問題文か記憶ベースのメモをもらえれば DATA カテゴリの種にする。それまで DATA は「業務データ処理」の仮定で進める。
2. **Anthropic API キー**: アプリ内評価には API キーが必要（20 分セッション 1 回 ≈ $0.4–0.8 を Opus 5.5 で想定）。キーを使わず MCP 経由（Claude Desktop のサブスク）だけで評価する運用にするかどうか。両方対応するが、どちらを既定にするか。
3. **Docker 環境**: Docker Desktop と OrbStack のどちらを使っているか（起動遅延の実測に影響）。
4. **GitHub リポジトリ名**: 例 `nico0748/LCI`。作成してもらえれば PR で出す。

## 8. 最初に潰す不確実性（実測タスク）

- `docker exec` 往復時間（Docker Desktop / OrbStack）と rustc/go build の arm64 コンパイル時間。
- whisper.cpp large-v3-turbo の Apple Silicon での処理速度と、日本語＋英語識別子混在音声の CER。
- `sandbox` iframe 内の無限ループが親ページを巻き込むか。
- Monaco の IME 入力時のイベント粒度（日本語コメント入力時のバースト）。
