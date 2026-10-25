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
| GET `/api/demos?problem=&language=` | D | `DemoSummary[]`（新しい順。台本の中身は含まないので reveal 不要）。`/api/demos*` はすべて録画中は 409 `{ error: "recording" }`、不正な id は 400 |
| GET `/api/demos/[demo_id]?reveal=1&revision=` | D | `DemoDetail`（`script` / `compiled` / `audio` / `audio_url_template` / `revisions`）。reveal が無ければ 403 |
| DELETE `/api/demos/[demo_id]?revision=&audio_only=1` | D | `{ deleted, demo_deleted, freed_bytes }`。revision 省略でデモ丸ごと、audio_only で音声だけ |
| GET `/api/demos/[demo_id]/audio?revision=` | D | `AudioJobStatus`（合成の進捗。ポーリング用） |
| POST `/api/demos/[demo_id]/audio?revision=&force=1` | D | 202 `{ status: "started"\|"generating", total }` / 200 `{ status: "ready" }` / 409 `{ error: "unavailable", reason }` |
| GET `/api/demos/[demo_id]/audio/[key]?reveal=1` | D | `audio/mp4`（AAC 区間、Range 対応・immutable） |

## パッケージの公開関数

- `@lci/evaluator`
  - `finalizeSession(store: SessionStore, sessionId: string, opts?: { whisperBin?, whisperModel?, skipTranscribe? }): Promise<Session>`
  - `evaluateSession(input: { store, problemsRoot, sessionId, model?, includeFrames?, apiKey? }): Promise<Evaluation>`
  - `buildEvaluationContext(...)`: MCP と API 評価で共有する「Claude に渡す材料」生成
- `@lci/runner`
  - `getRunner(): Runner` / `runner.status()` / `runner.run(req)` / `runner.judge(problem, req)`
- `@lci/mcp-server` は `@lci/core`・`@lci/evaluator`・`@lci/demo` のみに依存する（Next.js には依存しない。`@lci/demo` は 2026-10-25 追加、docs/requirements/demo/00_decisions.md D17）。
- `@lci/demo`（`@lci/core` と `@lci/runner` のみに依存。evaluator には依存しない）
  - `DemoService({ dataRoot, problemsRoot, runner? })`: `validate` / `save` / `summaries` / `detail` / `remove` / `audioStatus` / `startAudio`。MCP の demo ツールと `/api/demos/*` が同じものを使う
  - クライアントコンポーネントは `@lci/demo/browser`（型・`compileDemo` など node:* に依存しない部分）だけを import する

## 環境変数（`.env.local`、`apps/web/.env.example` に記載）

- `ANTHROPIC_API_KEY` 任意。無ければアプリ内評価ボタンは無効化し MCP 経由を案内。
- `LCI_WHISPER_BIN`（既定 `whisper-cli`）、`LCI_WHISPER_MODEL`（ggml-large-v3-turbo のパス）。無ければ文字起こしは `skipped` にし、UI で案内。
- `LCI_DATA_ROOT`, `LCI_PROBLEMS_ROOT` 任意。
- 模範解答デモ: `LCI_TTS_ENGINE`（`auto`＝say があれば使う / `say` / `fake` / `none`）、`LCI_TTS_VOICE`（既定 `Kyoko`）、`LCI_TTS_RATE`（say -r、既定 0＝声の既定）、`LCI_DEMO_AUDIO_MAX_MB`（全デモの音声の上限、既定 500）、`LCI_DEMO_ALLOW_FAKE=1`（テスト用: `LCI_RUNNER=fake` での台本検証を許す）、`LCI_DEMO_SPAWN_AUDIO=0`（MCP の保存後に音声合成を起動しない）、`LCI_APP_URL`（MCP が返す open_url の起点、既定 `http://localhost:3000`）。

## ディレクトリ分担（衝突回避）

- W1: `apps/web/src/app/(session)/**`, `apps/web/src/components/session/**`, `apps/web/src/lib/capture/**`, `apps/web/src/app/api/sessions/**`（finalize/evaluate を除く）, `apps/web/public/sandbox/**`
- W2: `apps/web/src/app/problems/**`, `apps/web/src/app/sessions/**`, `apps/web/src/components/review/**`, `apps/web/src/app/api/problems/**`, `GET /api/sessions*` 読み取り系
- R: `packages/runner/**`, `docker/**`, `apps/web/src/app/api/run/**`, `api/judge/**`, `api/runner/**`
- E: `packages/evaluator/**`, `packages/mcp-server/**`, `apps/web/src/app/api/sessions/[id]/finalize/**`, `.../evaluate/**`
- P: `packages/problem-tools/**`, `problems/**`
- D（模範解答デモ・バックエンド）: `packages/demo/**`, `packages/mcp-server/src/demo-tools.ts`, `apps/web/src/app/api/demos/**`, `apps/web/src/lib/demo/**`。再生 UI は `apps/web/src/components/demo/**`, `apps/web/src/app/problems/[id]/demo/**`
- `packages/core` は共有。フィールド追加は可、削除・改名は不可。

## E の追加メモ（2026-10-24）

- `@lci/core` への追加（追加のみ）: `Session.finalize?`（`finished_at_wall, elapsed_ms{remux,wav,stt,metrics,frames}, tools{ffmpeg,whisper}, frames, frame_source`）、`Evaluation.usage?`（API 評価のトークン使用量）。
- `Evaluation` 内の時刻（`feedback.t/t_end`, `evidence.t/t0/t1`, `code_ref.at`, `mentioned_at`）は **セッション時計のミリ秒**。モデル（API・MCP とも）には経過秒で書かせ、`@lci/evaluator` の `draftToEvaluation` が ms に変換する（MCP の `save_evaluation` は "mm:ss" も受け付ける）。
- `POST /finalize`: body `{ force?, skip_transcribe?, allow_cam_frames?, wait? }`。同一セッションの処理中は 202 `{status:"finalizing"}`、録画中は 409、`wait:false` で即 202。
- `POST /evaluate`: 503 `{error:"no_api_key"}` / 404 / 409 `not_ready` / 502 `{error: "refusal"|"parse_failed"|"api_error"}`。
- キーフレームは `derived/frames/<t>.jpg` と索引 `derived/frames/index.json`（`{source, frames:[{t, file, reason, source, media_s}]}`）。
