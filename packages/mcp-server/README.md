# @lci/mcp-server

LCI の練習セッションを Claude Desktop / Claude Code から読んで評価し、結果をアプリに保存する **stdio MCP サーバ**（サーバ名 `lci`）。
アプリ内評価（`@lci/evaluator` の `evaluateSession`）と **同じルーブリック・同じ出力スキーマ** を使う（要件書 03 §4, FR-E-07）。
依存は `@lci/core`・`@lci/evaluator`・`@lci/demo` だけで、Next.js が起動していなくても動く（同じ `data/` を読む）。
模範解答デモの台本（ナレーション＋ライブコーディング）を書いて保存するツールもある（下の「模範解答デモ」）。

## 起動

```sh
pnpm --filter @lci/mcp-server start          # = node --experimental-strip-types src/main.ts
node packages/mcp-server/bin/lci-mcp.mjs     # bin（Claude Desktop 設定ではこちらを使う）
```

環境変数:

| 変数 | 既定 | 用途 |
|---|---|---|
| `LCI_DATA_ROOT` | `<repo>/data` | セッションデータ（`sessions/<id>/…`） |
| `LCI_PROBLEMS_ROOT` | `<repo>/problems` | 問題バンク |
| `LCI_MCP_ALLOW_CAMERA` | 未設定 | `1` のときだけ `get_video_frames(source:"camera")` を許可（既定はカメラ映像を渡さない） |
| `LCI_TTS_ENGINE` | `auto` | デモの音声: `auto`（say があれば使う）/ `say` / `fake`（テスト用のビープ）/ `none` |
| `LCI_TTS_VOICE` / `LCI_TTS_RATE` | `Kyoko` / `0` | say の声と速さ（`say -v '?'` で日本語の声を確認。`pnpm --filter @lci/demo voices`） |
| `LCI_DEMO_SPAWN_AUDIO` | 未設定 | `0` のとき save_demo_script の後に音声合成を起動しない |
| `LCI_APP_URL` | `http://localhost:3000` | save_demo_script が返す `open_url` の起点 |
| `LCI_RUNNER` / `LCI_DEMO_ALLOW_FAKE` | 未設定 | デモの検証は Docker で実行する。`LCI_RUNNER=fake` はテスト用で、`LCI_DEMO_ALLOW_FAKE=1` が無いと拒否する |

stdout は JSON-RPC 専用。ログは stderr に出る。

## Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` に追加して Claude Desktop を再起動する。
`node` は Claude Desktop から見える絶対パスで書く（`which node` の結果。Homebrew なら `/opt/homebrew/bin/node`）。Node 22 以上。

```json
{
  "mcpServers": {
    "lci": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/yuumaro/LCI/packages/mcp-server/bin/lci-mcp.mjs"],
      "env": {
        "LCI_DATA_ROOT": "/Users/yuumaro/LCI/data",
        "LCI_PROBLEMS_ROOT": "/Users/yuumaro/LCI/problems"
      }
    }
  }
}
```

使い方: チャット入力欄の「+」→ プロンプト `evaluate_session` を選び、`session_id` を入れる（ID は「lci の list_sessions でセッション一覧を出して」と頼めば分かる）。
評価が終わると `save_evaluation` で `data/sessions/<id>/derived/evaluation-<n>.json` に保存され、アプリのレビュー画面に出る（route は `mcp`）。

## Claude Code

```sh
claude mcp add lci --scope user \
  -e LCI_DATA_ROOT=/Users/yuumaro/LCI/data \
  -e LCI_PROBLEMS_ROOT=/Users/yuumaro/LCI/problems \
  -- node /Users/yuumaro/LCI/packages/mcp-server/bin/lci-mcp.mjs
```

リポジトリ内で作業するだけなら `--scope project`（`.mcp.json` に書かれる）でもよい。確認は `claude mcp list`。
プロンプトは `/mcp__lci__evaluate_session <session_id>` で呼べる。

## 提供するもの

### Tools（時刻はすべて経過秒。`at` は mm:ss 表示）

| tool | 入力 | 出力 |
|---|---|---|
| `list_sessions` | `limit?, problem_id?, since?` | `[{session_id, problem_id, started_at, duration_s, language, has_video, has_transcript, eval_count}]` |
| `get_session_overview` | `session_id` | 問題文・言語・長さ・最終コード（行番号付き）・実行結果サマリ・metrics |
| `get_session_timeline` | `session_id, t0?, t1?, granularity_s?=10, page?, page_size?` | ビンごとの `speech_chars, edit_events, edit_lines, files_touched, run?, silence?` |
| `get_transcript` | `session_id, t0?, t1?` | `[{t0, t1, at, text, confidence, markers}]` |
| `get_edit_log` | `session_id, t0, t1, file?, page?, page_size?` | 編集要約（本文は 200 文字で切る） |
| `get_code_snapshot_at` | `session_id, t, file?` | その時刻の全文（行番号付き）＋直前スナップショットからの差分 |
| `get_problem_reference` | `problem_id` | 問題文・要件チェックリスト・トークポイント・採点ヒント・面接官メモ・参照解 |
| `get_rubric` | `version?` | ルーブリック本文＋few-shot アンカー＋文字起こし読み替え表 |
| `get_metrics` | `session_id` | 決定的に計算済みの指標（ms 単位、数え直さない） |
| `get_video_frames` | `session_id, t0, t1, max_frames?≤4, source?` | finalize が抽出した画面キーフレーム（image ブロック ≤4 枚、各前に時刻 text） |
| `save_evaluation` | `session_id, evaluation, model?` | スキーマ検証 → 秒→ms 変換 → 引用照合（不一致は speculative）→ overall 再計算 → 保存。`{evaluation_id, overall, demoted_to_speculative, warnings}` |

`save_evaluation` は同じプロセスで transcript / edit_log を参照していない場合に警告を `uncertainties` に付ける（03 §7）。

### Resources

- `lci://sessions/{id}/overview.json` — `get_session_overview` と同内容
- `lci://sessions/{id}/transcript` — 人間可読の文字起こし（`[mm:ss–mm:ss] 本文`）
- `lci://sessions/{id}/metrics.json`
- `lci://sessions/{id}/final` — 最終コード
- `lci://rubric/current` — ルーブリック markdown

### Prompts

- `evaluate_session(session_id, include_video?)` — `packages/evaluator/src/prompt.ts` の system prompt と同一のルーブリック・証拠ルール・反フラッタリング指示に、ツール取得手順と `save_evaluation` での保存指示を足したもの。

## 模範解答デモ（docs/requirements/demo/）

Claude が「どの順で、何を話しながら書くか」の台本を書き、アプリが検証して再生する（動画ではない）。手順はプロンプト `author_demo(problem_id, language, target_minutes?, focus?)` に入っている。
Claude Desktop なら「+」→ `author_demo`、Claude Code なら `/mcp__lci__author_demo alg-0001 python`。

| tool | 入力 | 出力 |
|---|---|---|
| `list_problems` | `category?, judge_kind?, language?, has_demo?` | 問題の一覧と `demo_supported`（web 問題は v1.1 まで不可）・既存のデモ |
| `get_problem_for_demo` | `problem_id, language` | 問題文・制約・requirements・talking_points・red_flags（rf1…）・採点ヒント・判定の種類とサンプル・編集するファイル（生テキスト）・参照解（生テキスト）・上限値・オーサリングガイド |
| `validate_demo_script` | `problem_id, language, draft` | 保存せずに検証（操作の適用 → Docker で各 run と最終コードを実行・判定 → タイミング → デモ自身の指標 → 網羅 → ナレーション lint）。`{ok, errors[{code, step_id, path, message, hint, context}], warnings, estimate, runs, judge}`。失敗しても isError にしない |
| `save_demo_script` | `problem_id, language, draft, demo_id?, note?, model?` | 同じ検証に通れば `data/demos/<problem>/<lang>/<demo_id>/` に新しい版として保存（最新 10 版）。`{demo_id, revision, url, open_url, audio, warnings}`。通らなければ isError |
| `list_demos` / `get_demo_script` / `delete_demo` | | 一覧 / 保存済みの draft と版 / 削除（版だけ・丸ごと） |

- Resources: `lci://guides/demo-authoring`（ガイド全文）、`lci://demos/{demo_id}/script.json`
- 音声: 保存後に切り離した子プロセス（`packages/demo/src/cli.ts synth`）が macOS の `say` → ffmpeg（AAC 32 kbps モノラル）で区間ごとに作る。MCP の応答は待たせない。say や ffmpeg が無ければ字幕だけで再生できる。作り直しは `LCI_DATA_ROOT=… pnpm --filter @lci/demo tts <demo_id> [--force]`
- 録画中（status=recording のセッションがある間）は検証・保存しない（`E_BUSY_RECORDING`）

## テスト

```sh
pnpm --filter @lci/mcp-server test       # SDK クライアントで stdio 起動して list_sessions 〜 save_evaluation、デモの get → validate → save → 音声 → delete を叩く
pnpm --filter @lci/mcp-server typecheck
```
