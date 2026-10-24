# 内部 API 契約（並列実装用）

各パッケージ／ページは以下の契約にだけ依存する。変更したい場合は追加のみ（既存フィールドは壊さない）。

## Route Handlers（apps/web/src/app/api）

| Method/Path | 担当 | 入出力 |
|---|---|---|
| GET `/api/problems` | W2 | `ProblemSummary[]` |
| GET `/api/problems/[id]` | W2 | `Problem`（`body.interviewer_notes` / `review_notes` / `tests` のシナリオ詳細は `?reveal=1` のときのみ含める） |
| POST `/api/sessions` | W1 | body `{ problem_id, language, capture_options }` → `Session`（status: preparing） |
| GET `/api/sessions` | W2 | `Session[]` |
| GET `/api/sessions/[id]` | W2 | `{ session, events_count, has_transcript, evaluations: number }` |
| POST `/api/sessions/[id]/events` | W1 | body `{ events: Event[] }`（JSON, バッチ）→ `{ ok, last_seq }` |
| POST `/api/sessions/[id]/snapshot` | W1 | body `{ file, t, version, text }` → `{ ref, sha1 }`（store.writeSnapshot ＋ snapshot イベント追記） |
| PUT `/api/sessions/[id]/media/[recorder]` | W1 | body = 生バイナリチャンク（`Content-Type: video/webm`）→ `{ bytes }`（store.appendMediaChunk） |
| POST `/api/sessions/[id]/start` | W1 | body `{ recorders: Recorder[] }` → status recording |
| POST `/api/sessions/[id]/end` | W1 | body `{ ended_t, reason }` → status finalizing、events を close、その後 `POST /finalize` を内部で呼ぶ（fire-and-forget） |
| POST `/api/sessions/[id]/finalize` | E | ffmpeg 再 mux → 音声抽出 → whisper → transcript.json → metrics.json → frames → status ready。`{ status }` を返す。冪等 |
| GET `/api/sessions/[id]/timeline` | W2 | `{ session, events, transcript, metrics, rows: TimelineRow[] }` |
| GET `/api/sessions/[id]/snapshot-at?file=&t=` | W2 | `{ text, version }`（core.reconstructFileAt） |
| GET `/api/sessions/[id]/media/[recorder]` | W2 | 動画ファイルを Range 対応で返す |
| GET `/api/sessions/[id]/evaluations` | W2 | `Evaluation[]` |
| POST `/api/sessions/[id]/evaluate` | E | body `{ model?, include_frames? }` → `Evaluation`（保存済み） |
| POST `/api/run` | R | body `{ session_id?, language, files: {path,content}[], entry, stdin? }` → `RunResult`（mode run） |
| POST `/api/judge` | R | body `{ session_id?, problem_id, language, files }` → `RunResult`（mode judge, stdio/unit のみ。web は W1 がブラウザ内で判定し `/api/sessions/[id]/runs` に保存） |
| POST `/api/sessions/[id]/runs` | W1 | body `RunResult` → `{ ref }`（store.saveRun ＋ run イベント追記） |
| GET `/api/runner/status` | R | `{ docker: "ok"\|"not_running"\|"missing", images: {lang, present}[] }` |
| POST `/api/runner/warm` | R | イメージ pull／コンテナ起動。SSE で進捗 |

## パッケージの公開関数

- `@lci/evaluator`
  - `finalizeSession(store: SessionStore, sessionId: string, opts?: { whisperBin?, whisperModel?, skipTranscribe? }): Promise<Session>`
  - `evaluateSession(input: { store, problemsRoot, sessionId, model?, includeFrames?, apiKey? }): Promise<Evaluation>`
  - `buildEvaluationContext(...)`: MCP と API 評価で共有する「Claude に渡す材料」生成
- `@lci/runner`
  - `getRunner(): Runner` / `runner.status()` / `runner.run(req)` / `runner.judge(problem, req)`
- `@lci/mcp-server` は `@lci/core` と `@lci/evaluator` のみに依存する（Next.js には依存しない）。

## 環境変数（`.env.local`、`apps/web/.env.example` に記載）

- `ANTHROPIC_API_KEY` 任意。無ければアプリ内評価ボタンは無効化し MCP 経由を案内。
- `LCI_WHISPER_BIN`（既定 `whisper-cli`）、`LCI_WHISPER_MODEL`（ggml-large-v3-turbo のパス）。無ければ文字起こしは `skipped` にし、UI で案内。
- `LCI_DATA_ROOT`, `LCI_PROBLEMS_ROOT` 任意。

## ディレクトリ分担（衝突回避）

- W1: `apps/web/src/app/(session)/**`, `apps/web/src/components/session/**`, `apps/web/src/lib/capture/**`, `apps/web/src/app/api/sessions/**`（finalize/evaluate を除く）, `apps/web/public/sandbox/**`
- W2: `apps/web/src/app/problems/**`, `apps/web/src/app/sessions/**`, `apps/web/src/components/review/**`, `apps/web/src/app/api/problems/**`, `GET /api/sessions*` 読み取り系
- R: `packages/runner/**`, `docker/**`, `apps/web/src/app/api/run/**`, `api/judge/**`, `api/runner/**`
- E: `packages/evaluator/**`, `packages/mcp-server/**`, `apps/web/src/app/api/sessions/[id]/finalize/**`, `.../evaluate/**`
- P: `packages/problem-tools/**`, `problems/**`
- `packages/core` は共有。フィールド追加は可、削除・改名は不可。
