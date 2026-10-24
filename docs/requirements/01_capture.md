# 01 キャプチャ基盤（録音・録画・文字起こし・編集ログ・時刻同期・保存）要件定義

対象: ライブコーディング面接練習アプリの **CAPTURE サブシステム**。
前提は brief.md（Mac ローカル起動の Next.js+TS+Monaco、言語別 Docker 実行、ローカル Whisper 系、ローカル MCP、データはローカル保存）。
本書は「批判的に」書いている。brief の前提のうち疑わしいものは §6 で明示的に反論する。

---

## 1. 目的

1. 練習セッション中の **発話（音声）・表情（Webカメラ）・編集行動（Monaco イベント）・実行結果** を、後段の解析（Claude via MCP）が使える形で**欠損なく**ローカルに残す。
2. 「いつ・何を話しながら・コードのどこを触っていたか」を **単一の時間軸** 上で対応付ける。これが本プロダクトの差別化点であり、キャプチャ層の唯一の本質要件。
3. 20〜60 分のセッションを、ブラウザクラッシュ・権限エラー・タブ切替・スリープがあっても **データを失わず** 終える。
4. 録画・文字起こしの「見た目のリアルタイム性」より、**事後解析の正確さと再現性**を優先する（理由は §6）。

非目的（本書の範囲外）: 評価ロジック、問題バンク、コード実行サンドボックス、MCP サーバの API 設計（ただし §5 のスキーマは MCP 側が読む契約として提示）。

---

## 2. 機能要件（FR-C-xx）

優先度: **MUST**（v1 必須）/ **SHOULD**（v1 で入れたいが落とせる）/ **COULD**（v2 以降）

### 2.1 録音・録画

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-01 | マイク音声を `getUserMedia` で取得し、セッション開始〜終了まで連続録音する。コーデックは Opus（WebM コンテナ）、モノラル。 | MUST |
| FR-C-02 | Web カメラ映像を音声と**同一の MediaStream** にまとめて 1 本の `MediaRecorder` で録画する（A/V 同期をブラウザに任せるため、別録りにしない）。解像度は 640×480 または 1280×720、≤24fps。 | MUST |
| FR-C-03 | `MediaRecorder.start(timeslice)` で 1〜3 秒ごとにチャンクを受け取り、**受け取った瞬間にローカル Next.js サーバへ POST（または WebSocket）して追記保存**する。ブラウザのメモリに Blob を蓄積しない。 | MUST |
| FR-C-04 | 画面録画は `getDisplayMedia({ preferCurrentTab: true, selfBrowserSurface: "include" })` で **自タブのみ**を既定とし、別ウィンドウ／全画面の選択は明示的な上級オプションとする（プライバシー、§2.6）。 | SHOULD |
| FR-C-05 | 画面録画は 5〜10fps、VP9 もしくは VP8、画面変化が少ないため低ビットレート（≤1 Mbps）に制限する。 | SHOULD |
| FR-C-06 | 録画開始前に「デバイス選択＋プレビュー＋音量メーター」を表示し、無音（RMS が閾値未満が 10 秒継続）を検知したらセッション中も警告バナーを出す。 | MUST |
| FR-C-07 | 録画トラックが `ended`（ユーザが Chrome の共有停止ボタンを押す、AirPods 切替でデバイス消失など）になった場合、セッションを止めずに **イベントログに `track_ended` を記録し、再取得を促す UI** を出す。残りのトラックは継続する。 | MUST |
| FR-C-08 | セッション終了時、サーバ側で `ffmpeg -c copy` により WebM を再 mux し、**Duration と Cues（シーク情報）** を付与する。MediaRecorder 出力の生 WebM は Duration が無くシーク不能なため。 | MUST |
| FR-C-09 | セッション終了時に 16kHz モノラル WAV（または FLAC）を音声トラックから抽出し、文字起こしの入力とする。 | MUST |
| FR-C-10 | 「音声のみ」「音声＋カメラ」「音声＋カメラ＋画面」をセッション開始時に選べる。 | MUST |
| FR-C-11 | 録画の一時停止／再開（休憩）。再開後も単一時間軸を維持し、pause 区間を `pause`/`resume` イベントとして残す。 | COULD |

### 2.2 文字起こし（日本語 STT）

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-20 | **確定版（authoritative）文字起こし**はセッション終了後に録音済み音声ファイルへ一括で実行する。モデルは Whisper 系（whisper.cpp + large-v3-turbo を第一候補、§4）。セグメント単位の開始・終了時刻と、可能なら単語（トークン）単位の時刻を出力する。 | MUST |
| FR-C-21 | 文字起こしの時刻は**メディア時間（音声ファイル先頭=0）**で出力し、§2.4 の変換でセッション時刻に写像する。 | MUST |
| FR-C-22 | 問題文・言語名・想定キーワード（例: `AbortController`, `debounce`, `Map`, `TTL`, `LRU`, `fetch`）を `initial_prompt`／語彙ヒントとして STT に渡し、英語識別子のカタカナ化（「アボートコントローラー」）や誤変換を減らす。 | SHOULD |
| FR-C-23 | **ライブ（暫定）文字起こし**: セッション中、VAD で区切った 3〜8 秒のチャンクをローカル STT サーバ（whisper.cpp small/base 程度）に投げ、暫定テキストを画面端に表示する。これは「話せているか」の自己フィードバック用で、保存される確定版とは別物であることを UI 上で明示する。 | SHOULD |
| FR-C-24 | ライブ文字起こしが落ちても（モデル未ロード、CPU 逼迫）録音・ログは継続する。ライブ STT は録音パイプラインと**プロセス・ストリームを分離**する。 | MUST |
| FR-C-25 | 無音・フィラー（「えー」「あー」）区間を検出し、セグメントに `is_filler`/無音長を付与する（評価側が「沈黙時間」を使うため）。 | SHOULD |
| FR-C-26 | 文字起こし結果の手動修正 UI（誤認識を直して保存）。 | COULD |
| FR-C-27 | クラウド STT（OpenAI/Deepgram）への切替オプション。既定 OFF、明示同意の上で ON。 | COULD |

### 2.3 コード編集イベントのログ

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-30 | Monaco の `onDidChangeModelContent` が返す `IModelContentChange[]`（`range`, `rangeLength`, `text`, `versionId`, `isUndoing`, `isRedoing`, `isFlush`）を**全件そのまま**記録する。キーストローク単位の `keydown` は記録しない（IME 合成中のキーは意味を持たず、change イベントで十分）。 | MUST |
| FR-C-31 | ファイルごとに **定期スナップショット**（60 秒ごと、または 300 change ごと、または `run` 実行直前）を全文で保存する。再生・解析時は直近スナップショット＋差分適用で任意時刻の全文を O(小) で復元できること。 | MUST |
| FR-C-32 | カーソル・選択範囲（`onDidChangeCursorSelection`）を 250ms デバウンスで記録する。 | MUST |
| FR-C-33 | **編集フォーカス（どこを編集しているか）**: カーソル位置を包含する最内のシンボル（関数／メソッド／クラス／HTML 要素／CSS ルール）を `{file, symbol_path, kind, range}` として解決し、**変化したときだけ** `focus` イベントを出す（500ms デバウンス）。 | MUST |
| FR-C-34 | シンボル解決は **web-tree-sitter（WASM）** を主とし、言語ごとの文法（C, Rust, Python, Go, TypeScript/JavaScript, HTML, CSS, PHP）でノード種別→シンボル種別のマッピングテーブルを持つ。構文エラー中でも tree-sitter のエラー回復により最内ノードを返せることを要件とする。 | MUST |
| FR-C-35 | tree-sitter が使えない／解析失敗時のフォールバックとして「インデントブロック＋直近の `def/func/fn/function/class` 行の正規表現」による粗いシンボル推定を行い、`confidence: "low"` を付ける。 | MUST |
| FR-C-36 | ファイル操作（作成・切替・リネーム・削除）、`run`（実行要求、言語、stdout/stderr 要約、exit code、所要時間）、`paste`（`onDidPaste`、貼り付け文字数）、`format`、undo/redo を離散イベントとして記録する。 | MUST |
| FR-C-37 | ブラウザの `visibilitychange`／`blur`/`focus`（タブ離脱・復帰）、画面共有の停止、ウィンドウリサイズを記録する（面接で「調べ物をした時間」の推定に使う）。 | MUST |
| FR-C-38 | イベントは **追記専用の JSON Lines** でサーバへ 1 秒ごと（または 50 件ごと）にフラッシュする。ブラウザ側は IndexedDB に二重書きし、サーバ ACK 済み分のみ削除する。 | MUST |
| FR-C-39 | 任意のユーザ手動マーカー（「ここから実装」「ここで詰まった」ボタン、ホットキー）。 | COULD |

### 2.4 時刻同期

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-40 | セッション内の全イベントは **`performance.now()` 由来の単調増加ミリ秒 `t`**（セッション開始=0）を持つ。壁時計（`Date.now()`、ISO8601）はセッションメタに `started_at_wall` として 1 回だけ記録し、イベントには持たせない（NTP 補正やスリープで壁時計が跳ぶため）。 | MUST |
| FR-C-41 | 各 MediaRecorder について、`onstart` 発火時刻 `t_rec_start`（`start()` 呼出時ではない）を記録する。メディア時間→セッション時刻は `t = t_rec_start + media_ms * scale` とする。 | MUST |
| FR-C-42 | `scale`（ドリフト補正係数）は終了時に `ffprobe` が返す実メディア長と、`t_rec_stop - t_rec_start` の比から算出し、セッションメタに保存する。1 を大きく外れる（±0.5% 超）場合は警告をログに残す。 | MUST |
| FR-C-43 | 60 秒ごとに `heartbeat` イベント（`t`, 受領チャンク累計バイト数, 累計チャンク数, `document.visibilityState`）を記録し、事後にチャンク欠落・停止区間を検出できるようにする。 | MUST |
| FR-C-44 | 文字起こしセグメントの `start/end` はメディア時間で保存し、`t_start/t_end`（セッション時刻）を派生フィールドとして併記する。元値を捨てない。 | MUST |
| FR-C-45 | 画面録画とカメラ録画が別 Recorder の場合、それぞれ独立に FR-C-41/42 を適用する（相互に同期させようとしない）。 | MUST |
| FR-C-46 | 起動時のセルフチェックとして「3 秒のテスト録音→ビープ音をスピーカーから鳴らしてマイクで拾う」ことでエンドツーエンドの固定遅延を測る。 | COULD |

### 2.5 保存

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-50 | セッションは `~/Library/Application Support/<app>/sessions/<session_id>/` 配下の 1 ディレクトリに閉じる（§5）。 | MUST |
| FR-C-51 | 録画中は `media/*.webm.part` に追記し、終了処理完了後に `.webm` にリネーム。`.part` が残っていれば「未完了セッション」として起動時に復旧フローを出す（FR-C-08 の再 mux で救済できる）。 | MUST |
| FR-C-52 | `session.json` は `status: recording | finalizing | ready | broken` を持ち、各段階で原子的に書き換える（tmp→rename）。 | MUST |
| FR-C-53 | サイズ予算: 60 分セッションで **合計 ≤ 1.0 GB**（内訳目安: カメラ 720p/1.0Mbps ≈ 450MB、画面 1Mbps ≈ 450MB、音声 48kbps ≈ 22MB、WAV16k ≈ 115MB、events ≤ 10MB）。20 分なら ≤ 350MB。音声のみモードは ≤ 150MB。 | MUST |
| FR-C-54 | ディスク空き容量が「見積もり×1.5」未満なら開始前に警告、録画中に 500MB を切ったらカメラ／画面録画を自動停止し音声＋イベントだけ継続する。 | SHOULD |
| FR-C-55 | 派生物（WAV、transcript、snapshots）は元データから再生成可能とし、`derived/` 配下に分離する。 | MUST |
| FR-C-56 | セッション削除は録画・派生物・イベントを完全削除（ゴミ箱ではなく unlink）。 | MUST |

### 2.6 プライバシー

| ID | 要件 | 優先度 |
|---|---|---|
| FR-C-60 | すべての生データ（映像・音声・編集ログ）はローカルに保存し、ユーザ操作なしにネットワークへ送らない。ライブ STT・確定 STT ともローカル推論が既定。 | MUST |
| FR-C-61 | MCP 経由で Claude に渡す既定の成果物は **transcript・events・snapshots・実行ログ・（任意で）間引いた静止画フレーム** とし、動画ファイル自体やカメラ映像は既定では渡さない。渡す場合は毎回明示同意。 | MUST |
| FR-C-62 | 画面録画は既定で自タブのみ（FR-C-04）。全画面を選んだ場合は「通知・他ウィンドウ・パスワードが映る可能性」を開始前に警告する。 | MUST |
| FR-C-63 | 初回起動時にデータの保存場所・送信先（Anthropic API 等の外部送信が起きるのは MCP 解析時のみ）を説明する同意画面を出す。 | MUST |
| FR-C-64 | 文字起こしから個人情報（氏名・大学名・メール）を正規表現／辞書でマスクするオプション。 | COULD |
| FR-C-65 | カメラ映像を保存せず「顔の有無・視線方向の統計量」だけを残すモード。 | COULD（v1 では作らない） |

---

## 3. 非機能要件

| 分類 | 要件 |
|---|---|
| 対応環境 | **macOS + Chrome（最新安定版）のみ**。Safari は MediaRecorder の WebM 非対応・`getDisplayMedia` 制約が強く、Firefox は `preferCurrentTab` 非対応のため v1 対象外。Apple Silicon を前提（Metal 推論）。 |
| 耐障害性 | ブラウザタブのクラッシュ・強制終了時、**失うデータは直近 ≤3 秒分の映像と ≤1 秒分のイベント**まで。サーバ（Next.js）プロセスが落ちた場合は IndexedDB 側のイベント複製で復旧できること。 |
| 性能 | 録画＋イベントログ＋ライブ STT 同時実行で、Monaco の入力遅延が体感で増えないこと（メインスレッドの長タスク ≤50ms）。tree-sitter の解析は Web Worker で行い、インクリメンタル解析を使う。 |
| 遅延 | ライブ STT の表示遅延 ≤5 秒（努力目標、SHOULD）。確定 STT は 60 分音声を M2/M3 クラスで **≤ 実時間の 1/5**（12 分以内）で完了（要確認: モデルと量子化に依存）。 |
| 精度 | 日本語技術トーク（英語識別子混じり）で CER ≤ 15%（要確認: 実測で決める。ベンチ用に自分の録音 10 分を正解付きで用意する）。 |
| 容量 | §2.5 の予算。古いセッションの自動削除はしない（ユーザ判断）。 |
| 時間軸精度 | 発話↔編集イベントのずれ ≤ 300ms（人間が「このコードを書きながら言った」と感じる粒度）。映像↔イベントは ≤ 500ms。 |
| 可観測性 | キャプチャの健全性（受領チャンク数、最終受領時刻、ドロップフレーム、STT キュー長）をセッション中の小さなステータス行に表示する。問題発生時にユーザが気づけることが最重要。 |
| 再現性 | `events.jsonl` + 初期スナップショットから、任意時刻のエディタ全文を決定的に復元できる（テストで担保）。 |
| 依存 | ネイティブ依存は `ffmpeg`、`whisper.cpp`（または whisper-server バイナリ）の 2 つに限定。Python 常駐は v1 では避ける（起動の複雑化を防ぐ）。 |

---

## 4. 技術選定比較表

### 4.1 日本語 STT

| 候補 | 動作形態 | 遅延（ライブ） | 日本語精度 | コスト | オフライン | 所見 |
|---|---|---|---|---|---|---|
| **whisper.cpp**（large-v3-turbo, Metal, q5/q8） | ローカル C++ バイナリ／`whisper-server` HTTP | チャンク方式で 2〜5 秒。公式 `stream` 例はスライディング窓で品質が落ちる | 高（large-v3 系）。英語識別子混在に比較的強い。カタカナ化は起きる | 0 | ○ | **確定版の第一候補**。トークン時刻（DTW）対応。Apple Silicon で実時間比 1/10 前後（要確認） |
| faster-whisper（CTranslate2） | Python プロセス | 同上。内蔵 VAD（Silero）が便利 | whisper.cpp と同等 | 0 | ○ | Mac では **GPU（Metal）非対応で CPU 推論**になり large 系が遅い（要確認）。Python 常駐が増える。Linux+CUDA なら第一候補だが本件は Mac |
| mlx-whisper / WhisperKit（Apple 専用） | Python（MLX）／Swift | 良好 | 同等 | 0 | ○ | Apple Silicon では whisper.cpp より速い報告あり（要確認）。Swift 製 WhisperKit は Web アプリから叩きにくい。v2 で差し替え候補 |
| kotoba-whisper / ReazonSpeech（日本語特化蒸留） | HF モデル（CTranslate2 変換可） | 速い（蒸留で軽量） | 日本語の純会話は Whisper large 以上の報告。**英語識別子・コード用語は弱い可能性**（要確認） | 0 | ○ | 候補として実測比較する価値あり。ただし技術トークのベンチが無い |
| Web Speech API（Chrome） | ブラウザ → **Google サーバ** | 1 秒未満、interim 結果あり | 日本語は実用的 | 0（Chrome） | **×**（Chrome はクラウド送信。一部環境の on-device 認識は要確認） | ローカル保存の前提に反する。約 60 秒で自動停止→再起動の隙間、単語時刻なし、語彙ヒント不可。**ライブ表示専用の暫定実装としてのみ検討可**だが、既定では採用しない |
| OpenAI Realtime（`gpt-4o-transcribe` 系） | WebSocket ストリーミング | 1 秒前後 | 高 | 従量（分課金、要確認） | × | 品質・遅延は最良クラスだが要ネット・要 API キー。v2 のオプション |
| Deepgram Nova 系（streaming, `ja`） | WebSocket | 1 秒未満 | 中〜高（日本語技術用語は要確認） | 約 $0.005〜0.01/分（要確認） | × | 単語時刻・話者分離が強い。v2 のオプション |

**決定**: 確定版 = whisper.cpp large-v3-turbo（Metal）、ライブ = whisper.cpp small/base を別プロセスで VAD チャンク推論（SHOULD）。Web Speech API は使わない。クラウドは v2 オプション。

### 4.2 録画方式

| 方式 | 利点 | 欠点 | 採否 |
|---|---|---|---|
| MediaRecorder（カメラ+音声を 1 Recorder、画面を別 Recorder） | 実装が最小。A/V 同期はブラウザ任せ | WebM に Duration/Cues 無し→再 mux 必須。ビットレート制御は粗い | **採用** |
| Canvas 合成（カメラ PiP を画面に重ねて 1 本） | ファイル 1 本、再生が楽 | `requestAnimationFrame` がバックグラウンドで止まる、CPU 負荷、画質劣化 | 不採用 |
| WebCodecs + 自前 mux（mp4-muxer 等） | 細かい制御、MP4 直出し | 実装量大、録画中クラッシュ時の復旧が難しい | v2 検討 |
| Electron/Tauri で OS 録画 | 権限 UI が自前、画面録画の制約が少ない | Web アプリ前提から逸脱 | 不採用（将来の選択肢） |

### 4.3 編集ログ粒度

| 粒度 | データ量（60 分） | 復元性 | 解析しやすさ | 採否 |
|---|---|---|---|---|
| keydown 単位 | 大（IME 中のキーは無意味） | 低（IME・ペーストを再現できない） | 低 | 不採用 |
| **Monaco change イベント全件** | 1〜5 MB | 完全（決定的に復元可） | 中（スナップショット併用で高） | **採用（一次データ）** |
| デバウンス diff（1〜2 秒） | 数百 KB | 中（タイプ順序が失われる） | 高 | 不採用（change から後で導出できる） |
| AST/シンボル単位の `focus` | 数 KB | — | 最高 | **採用（派生イベント、FR-C-33）** |

### 4.4 「どこを編集しているか」の解決

| 手段 | 言語網羅 | 構文エラー耐性 | 備考 |
|---|---|---|---|
| **web-tree-sitter** | C/Rust/Python/Go/TS/JS/HTML/CSS/PHP すべて WASM 文法あり | 高（エラー回復） | 採用。Worker で動かす。HTML 内 `<script>`/`<style>` はインジェクション解析が必要（v1 は HTML ノードまででよい） |
| Monaco 組込み言語サービス（DocumentSymbol） | TS/JS/HTML/CSS/JSON のみ | 中 | C/Rust/Go/Python/PHP が無い。TS では tree-sitter の検証用に使える |
| LSP（各言語サーバ） | 全言語 | 低〜中 | Docker 内に言語サーバを立てる運用コストが大きい。v1 では不要 |
| 正規表現＋インデント | 全言語 | 高（粗い） | フォールバック（FR-C-35） |

---

## 5. データスキーマ案（JSON 例）

```
sessions/<session_id>/
  session.json          # メタ・時計・状態
  events.jsonl          # 追記専用イベント（セッション時刻 t）
  media/
    cam.webm            # カメラ+音声（再 mux 済み）
    screen.webm         # 画面（任意）
    *.webm.part         # 録画中のみ存在
  derived/
    audio16k.wav
    transcript.json
    snapshots/<file_id>/<t>.txt
    frames/<t>.jpg      # 任意（MCP へ渡す間引き画像）
```

### 5.1 `session.json`

```json
{
  "schema_version": "1.0",
  "session_id": "2026-10-24T10-15-03_pixiv-search-form_a1b2",
  "status": "ready",
  "problem": { "id": "pixiv-2026-06-search-form", "time_limit_sec": 1200, "language": "javascript" },
  "started_at_wall": "2026-10-24T10:15:03.412+09:00",
  "ended_t": 1187432,
  "clock": { "origin": "performance.now", "unit": "ms" },
  "recorders": [
    {
      "id": "cam",
      "kind": "camera+mic",
      "file": "media/cam.webm",
      "mime": "video/webm;codecs=vp9,opus",
      "t_rec_start": 1532,
      "t_rec_stop": 1187001,
      "media_duration_ms": 1185410,
      "scale": 1.00005,
      "chunk_ms": 2000,
      "chunks_received": 593,
      "bytes": 148223901,
      "gaps": []
    },
    {
      "id": "screen",
      "kind": "display",
      "surface": "browser-tab",
      "file": "media/screen.webm",
      "t_rec_start": 1540,
      "t_rec_stop": 1187001,
      "media_duration_ms": 1185390,
      "scale": 1.00006
    }
  ],
  "stt": {
    "engine": "whisper.cpp",
    "model": "large-v3-turbo-q8_0",
    "language": "ja",
    "initial_prompt": "検索フォーム、fetch、AbortController、debounce、Map、TTL、LRU、キャッシュ",
    "word_timestamps": true,
    "elapsed_ms": 95210
  },
  "capture_options": { "camera": true, "screen": true, "live_stt": true },
  "warnings": [
    { "t": 402133, "code": "track_ended", "detail": "audio input device changed" }
  ],
  "files": [ { "file_id": "f1", "path": "index.html", "language": "html" } ]
}
```

### 5.2 `events.jsonl`（1 行 1 イベント）

```jsonl
{"t":0,"type":"session_start","seq":1}
{"t":1532,"type":"recorder_start","seq":2,"recorder":"cam"}
{"t":5210,"type":"file_open","seq":3,"file":"f1","language":"html"}
{"t":5215,"type":"snapshot","seq":4,"file":"f1","version":1,"ref":"derived/snapshots/f1/5215.txt","sha1":"..."}
{"t":18840,"type":"edit","seq":5,"file":"f1","version":37,"changes":[{"range":[12,1,12,1],"rangeLength":0,"text":"const cache = new Map();\n"}],"undo":false,"flush":false}
{"t":19120,"type":"cursor","seq":6,"file":"f1","pos":[13,1],"sel":null}
{"t":19400,"type":"focus","seq":7,"file":"f1","symbol":{"path":["script","search"],"kind":"function","range":[9,1,31,2]},"confidence":"high","resolver":"tree-sitter"}
{"t":42000,"type":"paste","seq":8,"file":"f1","chars":212}
{"t":60000,"type":"heartbeat","seq":9,"visibility":"visible","cam_chunks":30,"cam_bytes":7512003,"screen_chunks":30}
{"t":301220,"type":"visibility","seq":10,"state":"hidden"}
{"t":318900,"type":"visibility","seq":11,"state":"visible"}
{"t":645000,"type":"run","seq":12,"file":"f1","runtime":"node:20","exit_code":0,"duration_ms":812,"stdout_ref":"derived/runs/645000.out","stderr_len":0}
{"t":1187432,"type":"session_end","seq":13,"reason":"user"}
```

`range` は Monaco の 1 始まり `[startLine, startCol, endLine, endCol]`。`seq` はブラウザ側連番で、クラッシュ復旧時の重複排除に使う。

### 5.3 `derived/transcript.json`

```json
{
  "schema_version": "1.0",
  "recorder": "cam",
  "engine": "whisper.cpp large-v3-turbo-q8_0",
  "segments": [
    {
      "id": 12,
      "start_ms": 17210, "end_ms": 21980,
      "t_start": 18743, "t_end": 23513,
      "text": "まず同じクエリはキャッシュから返すようにMapを用意します",
      "avg_logprob": -0.21, "no_speech_prob": 0.02,
      "is_filler": false,
      "words": [
        { "w": "まず", "start_ms": 17210, "end_ms": 17500 },
        { "w": "同じ", "start_ms": 17520, "end_ms": 17900 }
      ]
    },
    { "id": 13, "start_ms": 21980, "end_ms": 29400, "t_start": 23513, "t_end": 30934, "text": "", "silence_ms": 7420 }
  ]
}
```

`t_start = recorders[cam].t_rec_start + start_ms * scale`。解析側は `t_*` だけ見ればよく、元の `*_ms` は再計算用に保持する。

---

## 6. リスクと反論

### 6.1 「たぶん間違っている前提」

| brief の前提 | 反論 | 本書の立場 |
|---|---|---|
| リアルタイム文字起こしが必要 | 練習は一人で行い、評価は終了後。リアルタイム性が価値を生むのは「いま自分が黙っている」ことへの気づき程度。Whisper のストリーミングは精度が落ち、確定版を別途作ることになり二重実装になる | ライブ STT は SHOULD、**表示専用**。確定版は事後バッチ |
| 画面録画が必要 | エディタはアプリ自身なので、編集ログから任意時刻の画面を**正確に再構成できる**。画面録画が意味を持つのは「アプリ外で何を見たか」だけで、それはプライバシー上むしろ録りたくない情報 | 画面録画は SHOULD、自タブ限定。v1 の解析パイプラインは events を一次ソースにする |
| Claude が動画を解析する | MCP/API で渡せるのは静止画と文字。60 分動画を毎秒 1 枚でも 3,600 枚で現実的でない。表情・視線の評価は精度も倫理も怪しい | Claude に渡すのは transcript+events+数十枚の間引きフレーム。動画は人間の振り返り用 |
| 「どこを編集しているか」は行番号で足りる | 行番号は編集で動くため、後から「`search()` 関数内」と言えない。シンボル単位の `focus` が必要 | tree-sitter によるシンボル解決を MUST に格上げ |
| キーストローク記録が詳細で良い | IME 入力（日本語コメント）では keydown と確定文字が一致せず、再現不能なゴミになる | Monaco change イベントを一次データに |
| ローカル Whisper は「ローカルなので簡単」 | モデル配布（1.5GB 級）・初回ダウンロード・Metal ビルド・メモリ（large で 3GB 超）・ファンが回る。初回体験を壊しやすい | インストーラでモデルを事前取得、small で動作確認→large はバックグラウンド取得 |
| Web アプリでよい | 録画の権限 UI・バックグラウンド制限・クラッシュ復旧はすべてブラウザ制約との戦い。Tauri/Electron なら半分消える | v1 は Web のまま進めるが、**録画層だけ差し替え可能**なインタフェース（`CaptureBackend`）に切る |
| 20〜60 分 | Pixiv 実試験は 20 分。60 分は「余裕」であって要件ではない。60 分対応はサイズ・ドリフト・メモリで難度が上がる | **v1 は 30 分上限**で設計・テストし、60 分は非機能の努力目標 |
| 文字起こし精度は Whisper なら十分 | 日本語＋英語識別子のコードスイッチングは Whisper の弱点。「フェッチ」「マップ」「アボートコントローラー」に化け、評価側が「正しい用語を使えているか」を誤判定する | `initial_prompt` に問題固有語彙、評価側は「カタカナ＝英語識別子」の正規化辞書を持つ |

### 6.2 失敗モードと対策

| 失敗モード | 影響 | 対策 |
|---|---|---|
| マイク／カメラ権限拒否 | 録音ゼロ | 開始前のデバイスチェック画面を必須化。`NotAllowedError` 時はシステム設定への導線と「音声なしで続行（イベントのみ）」を提示。記録済みであることを `session.json.warnings` に残す |
| 入力デバイスの途中切替（AirPods 接続・抜去） | トラック `ended`、以降無音 | FR-C-07。`devicechange` を監視し、再 `getUserMedia` → **新しい Recorder を別ファイル**（`cam-2.webm`）として開始、`t_rec_start` を個別に記録。既存ファイルを継ぎ足さない |
| 画面共有停止ボタン（Chrome の共有バー） | 画面録画だけ止まる | `track.onended` を捕捉、`screen_stopped` イベント、再共有ボタン。セッションは継続 |
| タブ切替・バックグラウンド | `setTimeout` が 1 秒に間引かれる、`rAF` 停止。MediaRecorder 自体は継続するが Canvas 合成は止まる | Canvas 合成を使わない（§4.2）。フラッシュのタイマは Worker 側で回す。`visibility` イベントを記録し「離席／調べ物」として解析側に渡す |
| Mac スリープ・蓋閉じ | 録画が止まる、`performance.now()` はスリープ中進まない（要確認: Chrome の実装依存） | heartbeat の欠落で検出、`gaps` に記録。復帰時に Recorder を再起動 |
| ブラウザクラッシュ／タブ強制終了 | メモリ上のデータ全損 | チャンク即送信＋サーバ追記（FR-C-03）、イベントの IndexedDB 二重化（FR-C-38）、`.part` からの復旧（FR-C-51）。**復旧テストを受け入れ条件にする**（録画中に `kill -9` して再 mux できること） |
| Next.js サーバ側クラッシュ | チャンク受領不能 | ブラウザ側は POST 失敗時に OPFS（Origin Private File System）へフォールバック保存し、復帰後に再送。OPFS 容量は数 GB 使えるが要確認 |
| 生 WebM が再生不能・シーク不能 | 動画の振り返りができない | FR-C-08 の再 mux。再 mux 自体も失敗したら `ffmpeg -err_detect ignore_err` で救済 |
| 60 分でドリフト | 発話とコードがずれる | FR-C-42 の線形補正。実測で ±0.5% を超えるなら heartbeat ベースの区分線形補正に拡張 |
| ディスク満杯 | 録画破損 | FR-C-54 |
| IME 合成中の大量 change イベント | ログ肥大・focus のちらつき | change は全件記録（復元に必要）、focus は 500ms デバウンス。日本語コメント入力は想定内 |
| tree-sitter が HTML 内 JS を解決できない | Pixiv 問題（単一 HTML）で focus が `<script>` 止まり | v1 は HTML の `<script>` 内容を JS 文法で**二次解析**する特別扱いを入れる（Pixiv 問題が主要ユースケースのため） |
| 自動フォーマット／大量ペーストで巨大 change | 1 イベントが数十 KB | 記録はするが、解析側は `paste`/`format` を別扱い。`isFlush` の場合は直後にスナップショット |
| ライブ STT が CPU を食い Monaco が重くなる | 練習体験の悪化 | STT は別プロセス（whisper-server）、スレッド数上限、重い時は自動で停止して録音だけ継続（FR-C-24） |
| Whisper の幻覚（無音区間に「ご視聴ありがとうございました」） | 評価がノイズを拾う | VAD で無音区間を STT に渡さない、`no_speech_prob` 閾値、既知フレーズの除去リスト |
| ユーザが問題を見ずに話し始める／開始ボタン押し忘れ | 冒頭欠落 | 「問題表示」と「録画開始」を同一ボタンに。開始前はエディタをロック |

---

## 7. v1 スコープ提案

### 入れる（MUST）
- Chrome + macOS のみ。カメラ+マイクを 1 Recorder、2 秒チャンクで即時サーバ保存、終了時 ffmpeg 再 mux。
- Monaco change 全件＋60 秒スナップショット＋カーソル＋`focus`（tree-sitter: **JS/TS/HTML(+script 内 JS)/Python** の 4 系統をまず実装、残り言語は正規表現フォールバック）。
- `visibility`/`paste`/`run`/`heartbeat` イベント。
- 確定 STT: whisper.cpp large-v3-turbo、`initial_prompt` 付き、セグメント＋単語時刻、無音検出。
- 単一時計（`performance.now`）＋ `t_rec_start` ＋線形 `scale` 補正。
- §5 のディレクトリ／スキーマ、`.part` 復旧フロー、クラッシュ復旧の自動テスト。
- プライバシー: 全ローカル、MCP へは動画を渡さない既定、同意画面。
- セッション上限 30 分（UI で 20 分タイマー＋延長）。

### 入れたいが落とせる（SHOULD）
- 画面録画（自タブ限定）。
- ライブ STT（small モデル、表示専用）。
- フィラー検出、ディスク残量ガード。
- C/Rust/Go/PHP/CSS の tree-sitter マッピング。

### 作らない（COULD → v2）
- クラウド STT、Web Speech API。
- 一時停止／再開、手動マーカー、文字起こし修正 UI。
- 表情・視線解析、動画そのものの Claude 解析。
- 60 分超セッション、Safari/Firefox、Windows。
- WebCodecs 自前 mux、Electron/Tauri 化（ただし `CaptureBackend` 抽象だけは最初から置く）。

### 受け入れ条件（抜粋）
1. 20 分の模擬セッション後、任意の発話セグメントを選ぶと、その時点のエディタ全文と `focus` シンボルが 300ms 以内の精度で表示される。
2. 録画中に Chrome タブを強制終了→再起動で、終了直前 3 秒以内までの映像と全イベントが復旧し `status: ready` になる。
3. 60 分連続録画で `scale` の 1 からの乖離が 0.5% 未満、合計サイズが 1.0 GB 未満。
4. 自分の 10 分録音に対する CER を測定し数値を記録する（閾値は実測後に決める）。
