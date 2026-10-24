# @lci/mcp-server

LCI の練習セッションを Claude Desktop / Claude Code から読んで評価し、結果をアプリに保存する **stdio MCP サーバ**（サーバ名 `lci`）。
アプリ内評価（`@lci/evaluator` の `evaluateSession`）と **同じルーブリック・同じ出力スキーマ** を使う（要件書 03 §4, FR-E-07）。
依存は `@lci/core` と `@lci/evaluator` だけで、Next.js が起動していなくても動く（同じ `data/` を読む）。

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

## テスト

```sh
pnpm --filter @lci/mcp-server test       # SDK クライアントで stdio 起動して list_sessions 〜 save_evaluation を叩くスモークテスト
pnpm --filter @lci/mcp-server typecheck
```
