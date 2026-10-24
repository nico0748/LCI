# Mac セットアップ（文字起こし・評価・MCP）

対象: Apple Silicon の macOS + Chrome（D15）。録画の再 mux・文字起こし・キーフレーム抽出・Claude 評価を動かすための手順。
アプリ本体（`pnpm install` → `pnpm dev`）とは独立に、ここに書いたものが無くてもセッションの録画・保存はできる。足りないものがあれば終了処理は **警告付きで `ready` まで進み**、文字起こしは `skipped` になる。

## 1. ffmpeg と whisper.cpp

```sh
brew install ffmpeg whisper-cpp
which ffmpeg ffprobe whisper-cli    # /opt/homebrew/bin/... が出れば OK
whisper-cli --help | head -5        # Metal 対応ビルドであること（起動ログに "Metal" / "MTL" が出る）
```

- `ffmpeg`: 録画（`media/<id>.webm.part`）の再 mux（Duration / Cues 付与）、16 kHz モノラル WAV 抽出、画面キーフレーム抽出に使う。
- `whisper-cli`: Homebrew の `whisper-cpp` に入っている CLI（古い版は `whisper-cpp` / `main` という名前だった。その場合は `LCI_WHISPER_BIN` に実名を書く）。
- アプリは `PATH` に加えて `/opt/homebrew/bin` と `/usr/local/bin` も探すので、GUI から起動した場合でも通常は見つかる。

## 2. モデル（ggml-large-v3-turbo）

```sh
mkdir -p ~/models/whisper && cd ~/models/whisper
curl -L -o ggml-large-v3-turbo.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
ls -lh ggml-large-v3-turbo.bin      # 約 1.6 GB（要確認）
```

- メモリや速度が厳しい場合は量子化版 `ggml-large-v3-turbo-q5_0.bin`（約 0.55 GB、要確認）を同じ URL 配下から取得し、`LCI_WHISPER_MODEL` をそちらに向ける。日本語＋英語識別子の精度差は自分の録音で比べること（01 §3 の CER 計測）。
- 動作確認（16 kHz WAV が必要）:

```sh
ffmpeg -i 何かの録音.m4a -ac 1 -ar 16000 /tmp/test16k.wav
whisper-cli -m ~/models/whisper/ggml-large-v3-turbo.bin -f /tmp/test16k.wav -l ja -oj -of /tmp/test
cat /tmp/test.json | head -40
```

## 3. 環境変数（`apps/web/.env.local`）

```sh
cp apps/web/.env.example apps/web/.env.local
```

| 変数 | 必須 | 説明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 任意 | アプリ内評価（`POST /api/sessions/[id]/evaluate`）に使う。無ければ 503 `{error:"no_api_key"}` になり、UI は MCP 経由を案内する |
| `LCI_WHISPER_BIN` | 任意 | 既定 `whisper-cli` |
| `LCI_WHISPER_MODEL` | 文字起こしするなら必須 | 例 `/Users/yuumaro/models/whisper/ggml-large-v3-turbo.bin` |
| `LCI_DATA_ROOT` / `LCI_PROBLEMS_ROOT` | 任意 | 既定はリポジトリ直下の `data/` と `problems/` |

`.env.local` を書き換えたら `pnpm dev` を再起動する。評価 CLI も同じファイルを読む。

## 4. 終了処理と評価をコマンドで動かす（デバッグ用）

通常はセッション終了時にアプリが自動で `POST /api/sessions/<id>/finalize` を呼ぶ。手で再実行したいとき:

```sh
pnpm --filter @lci/evaluator cli list                         # セッション一覧（ID / status / 文字起こし状態）
pnpm --filter @lci/evaluator cli finalize <session_id>         # 冪等。何度実行してもよい
pnpm --filter @lci/evaluator cli finalize <session_id> --force # transcript / frames を作り直す
pnpm --filter @lci/evaluator cli evaluate <session_id> --dry-run --out /tmp/req.json  # API を呼ばずにプロンプトと入力を確認
pnpm --filter @lci/evaluator cli evaluate <session_id>         # Anthropic API で評価して保存（課金あり）
```

HTTP から:

```sh
curl -X POST localhost:3000/api/sessions/<id>/finalize -d '{}'               # 完了まで待って {status, stt, finalize, warnings}
curl -X POST localhost:3000/api/sessions/<id>/finalize -d '{"wait":false}'   # 202 ですぐ返す
curl -X POST localhost:3000/api/sessions/<id>/evaluate -d '{}'               # Evaluation（保存済み）
```

終了処理の中身（`packages/evaluator/src/finalize.ts`）:

1. `media/<rec>.webm.part` → `ffmpeg -fflags +genpts -i part -c copy media/<rec>.webm`、`ffprobe` で実長 → `media_duration_ms`、`scale = (t_rec_stop − t_rec_start) / media_duration_ms`（0.98–1.02 に丸め、外れたら警告）
2. cam から `derived/audio16k.wav`（16 kHz モノラル）
3. `whisper-cli -l ja -oj -ojf -ml 0 --prompt <問題の用語>` → `derived/transcript.json`（`t = t_rec_start + ms × scale`、3 秒以上の空白は無音セグメント、フィラーに印）
4. `derived/metrics.json`（`@lci/core` の `computeMetrics`）
5. 画面録画から出来事駆動のキーフレーム最大 16 枚 → `derived/frames/<t>.jpg`（長辺 1280px、カメラ映像は既定で使わない）
6. `session.json` の `status: ready`、各ステップの所要時間は `finalize.elapsed_ms`

## 5. 処理時間の目安（20 分セッション、すべて要確認）

| 工程 | 目安 | 備考 |
|---|---|---|
| 再 mux（cam + screen） | 数秒 | `-c copy` なので再エンコードなし |
| WAV 抽出 | 5–15 秒 | |
| whisper large-v3-turbo（Metal） | **M1/M2: 約 1.5–4 分、M3/M4: 約 1–2.5 分**（要確認） | 実時間比 1/5–1/12 程度の想定。量子化 q5_0 で短縮、初回はモデル読み込みで +10–20 秒 |
| キーフレーム 16 枚 | 10–30 秒 | 1 枚ずつシーク抽出 |
| アプリ内評価（claude-opus-5-5, effort high） | 1–3 分 | 03 §8.2。1 回 ≈ $0.4–0.8（要確認） |

実測したらこの表を更新すること（`session.json` の `stt.elapsed_ms` と `finalize.elapsed_ms` に記録される）。

## 6. Claude Desktop / Claude Code（MCP）

API キーを使わずに Claude のサブスクで評価する場合。詳細は `packages/mcp-server/README.md`。

Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`

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

Claude Code:

```sh
claude mcp add lci --scope user \
  -e LCI_DATA_ROOT=/Users/yuumaro/LCI/data -e LCI_PROBLEMS_ROOT=/Users/yuumaro/LCI/problems \
  -- node /Users/yuumaro/LCI/packages/mcp-server/bin/lci-mcp.mjs
```

使い方: プロンプト `evaluate_session` に session_id を渡す → Claude が overview / timeline / transcript / edit_log を読み → `save_evaluation` で保存 → アプリのレビュー画面に反映。

## 7. トラブルシュート

| 症状 | 原因と対処 |
|---|---|
| `stt.status = skipped`、error に「whisper-cli が見つかりません」 | `brew install whisper-cpp`、または `LCI_WHISPER_BIN` に絶対パス |
| 「LCI_WHISPER_MODEL … 存在しません」 | `.env.local` のパスを確認して `pnpm dev` 再起動 → `cli finalize <id>` |
| `warnings` に `ffmpeg_missing` / `remux_skipped` | ffmpeg を入れて `cli finalize <id>` を再実行（生 WebM を再 mux し直す） |
| `scale_out_of_range` | 録画が途中で止まった / スリープした可能性。発話とコードの対応が数秒ずれることがある |
| 文字起こしに「ご視聴ありがとうございました」 | Whisper の無音幻覚。単独セグメントなら自動で除去している |
| 評価が 503 `no_api_key` | `ANTHROPIC_API_KEY` を設定して再起動、または MCP 経由で評価 |
