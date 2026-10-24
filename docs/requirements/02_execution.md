# 02 コード実行サブシステム 要件定義

対象: ブラウザ内エディタから投入されたコードを、ローカルMac上で安全に実行し、テスト採点結果とエラーをエディタへ返す仕組み。
対象言語: C / Rust / Python / Go / TypeScript（Node + ブラウザ）/ HTML・CSS・JS（iframeライブプレビュー）/ PHP。

前提（仮定・未確定）:
- A1. Apple Silicon Mac、Docker Desktop または OrbStack が導入済み（arm64 イメージを使う）。
- A2. 単一ユーザ・ローカル利用。脅威モデルは「自分のラップトップを壊さない／固まらせない」であり、マルチテナントの悪意ある攻撃者対策ではない。
- A3. アプリ本体は Next.js（TS）。実行基盤はそのサーバ側プロセスから Docker API を叩く（dockerode 等）。
- A4. 面接練習の性質上、1問あたりのコードは1ファイル〜数ファイル、外部ライブラリ依存なしが基本。

---

## 目的

1. **即時フィードバック**: 「実行」押下から標準出力または最初のエラー表示まで **1.5 s 以内**（p50）、コンパイル言語でも 3 s 以内（p95）。練習中の思考を止めないことが最優先。
2. **安全な暴走対策**: 無限ループ・fork bomb・巨大メモリ確保・ディスク書き潰し・外部ネットワーク到達を、ホストに影響なく打ち切れる。
3. **採点の再現性**: AtCoder型（stdin/stdout）、ユニットテスト型、ビジュアル型（HTML/CSS）、挙動観測型（Pixiv型: リクエスト回数など）の4種を同一のJSON定義で扱い、結果を同一フォーマットで評価用ログ（MCP経由でClaudeが読む）に残す。
4. **UXとしての親切なエラー**: コンパイルエラー・実行時例外・TLE・OOM を判別して、エディタ上の行にマーカーを出す。

非目的（v1でやらないこと）: マルチユーザ、クラウド実行、任意パッケージのインストール（pip/npm/cargo add）、GPU、対話型TTY（REPL）。

---

## 機能要件

### FR-X-01 実行基盤（サンドボックス）

| ID | 要件 | 優先度 |
|---|---|---|
| FR-X-01-1 | 各言語ごとに Docker イメージを1つ用意し、アプリ起動時に**言語別ウォームコンテナ**を1本ずつ立ち上げ、実行要求ごとに `docker exec` で処理する。 | MUST |
| FR-X-01-2 | コンテナは `--network none`、`--read-only`（作業領域のみ tmpfs）、`--cap-drop ALL`、`--security-opt no-new-privileges`、非rootユーザ、`--pids-limit 256`、`--memory 512m`（言語別に上書き可）、`--cpus 2` で起動する。 | MUST |
| FR-X-01-3 | 1実行の上限: 壁時計タイムアウト（既定 CPU 2 s / 壁時計 5 s、コンパイルは別枠 10 s）、出力上限（stdout+stderr 合計 1 MiB、超過時は OLE として打ち切り）、書込可能領域 64 MiB tmpfs。 | MUST |
| FR-X-01-4 | タイムアウト／OOM／出力超過が起きた実行の後は、該当言語のウォームコンテナを**破棄して再作成**する（ゾンビプロセス・残留ファイルの持ち越し防止）。再作成中は次の実行をキューイングする。 | MUST |
| FR-X-01-5 | 同時実行は言語ごとに 1、全体で 2 まで。超過分はキューに入れ、UIには「待機中」を表示。 | SHOULD |
| FR-X-01-6 | HTML/CSS/JS 問題は Docker を使わず、ブラウザ内 `<iframe sandbox>` で実行する（別オリジンに相当する `srcdoc` + `sandbox="allow-scripts"`、`allow-same-origin` は付与しない）。 | MUST |
| FR-X-01-7 | ブラウザ向け TypeScript は esbuild-wasm でブラウザ内トランスパイルし、FR-X-01-6 の iframe で実行する（型検査は行わず、型エラーはエディタ側の Monaco TS worker に任せる）。 | SHOULD |
| FR-X-01-8 | Python の「お試し実行」（テスト採点を伴わない Run）は Pyodide でブラウザ内実行できるようにする。採点は常に Docker 側の CPython で行う。 | COULD |
| FR-X-01-9 | Docker が起動していない／イメージ未取得の場合、実行ボタンの代わりに「Docker を起動してください」「イメージを取得（約 N MB）」の案内を出し、取得進捗を表示する。 | MUST |

### FR-X-02 テストランナー

| ID | 要件 | 優先度 |
|---|---|---|
| FR-X-02-1 | **stdin/stdout 判定**: テストケースごとに stdin を与え、stdout を期待値と比較する。比較モードは `exact` / `token`（空白・改行の差を無視）/ `float`（絶対・相対誤差）/ `checker`（判定スクリプト）を持つ。 | MUST（checker は COULD） |
| FR-X-02-2 | **ユニットテスト型**: 問題側がテストハーネス（言語別の固定ファイル）を提供し、ユーザコードと結合して実行する。結果は「テスト名・pass/fail・メッセージ」の配列で返す。 | MUST |
| FR-X-02-3 | ユニットテスト用ハーネスの言語別既定: Python=`unittest`（標準）、Go=`go test`、Rust=`rustc --test`（cargo なし）、TS/JS=`node:test`、C=自前の最小 assert ヘッダ、PHP=自前の最小 assert 関数。追加依存ゼロで済むものに限定する。 | MUST |
| FR-X-02-4 | **DOM 判定型**（HTML/CSS/JS）: iframe 内に採点スクリプトを注入し、`querySelector` と `getComputedStyle` で構造・レイアウトを検証する（例: input と button が同じ行にある＝`getBoundingClientRect().top` が一致）。 | MUST |
| FR-X-02-5 | **操作シナリオ型**: DOM 判定の前に、`type` / `click` / `wait` / `expectRequests` などのステップを順に実行できる（Pixiv 型で必須）。 | MUST |
| FR-X-02-6 | **スクリーンショット**: iframe の見た目を PNG として保存し、タイムライン（録画側）とセッションログに添付する。v1 は「人（Claude）が見る」用途であり、画像差分による自動採点はしない。 | SHOULD |
| FR-X-02-7 | テストケースは `sample`（ユーザに見せる）と `hidden`（採点のみ）を区別し、Run は sample のみ、Submit は全件を実行する。 | MUST |
| FR-X-02-8 | 1ケース失敗で以降を打ち切るか全件実行するかを問題ごとに指定できる（既定: 全件実行、TLE 2 連続で打ち切り）。 | SHOULD |
| FR-X-02-9 | 採点結果は、各ケースの verdict（AC/WA/RE/TLE/MLE/OLE/CE）、実行時間、最大 RSS、stdout 先頭 4 KiB、期待値との diff を含む JSON として保存し、MCP の評価エージェントがそのまま読めるようにする。 | MUST |

### FR-X-03 Pixiv 型（fetch + キャッシュ）問題の実行と検証

| ID | 要件 | 優先度 |
|---|---|---|
| FR-X-03-1 | プレビュー iframe 内に **fetch / XMLHttpRequest のシム**を注入し、問題定義の `mockApi.routes` に合致する URL（例 `https://api.example.com/search?q=`）への呼び出しをネットワークに出さず、定義済みレスポンスで応答する。 | MUST |
| FR-X-03-2 | シムは全リクエストを `{ts, url, method, query, aborted}` として親ウィンドウへ `postMessage` し、親が集計する。`AbortController` による中断も `aborted: true` として記録する。 | MUST |
| FR-X-03-3 | モックは `latencyMs`（固定 or 範囲）と `failRate` を設定でき、「貧弱なサーバ」を再現できる。 | SHOULD |
| FR-X-03-4 | 「サーバへの優しさ」は操作シナリオ単位で採点する。例: 同一クエリ 2 回検索 → リクエスト 1 回（キャッシュ）、空クエリ → 0 回、連打 5 回 → 1 回到達 or 残りが aborted。 | MUST |
| FR-X-03-5 | シナリオ結果は「要求回数の期待と実測」「どの最適化が観測されたか（dedupe / empty-skip / abort / debounce）」として保存し、Claude の講評材料にする。TTL 切れの検証は `wait` ステップと偽装時計（`Date.now` のモック）で行う。 | SHOULD（偽装時計は COULD） |
| FR-X-03-6 | Tailwind 埋め込みは、Play CDN 相当のスクリプトをアプリ内にバンドル（ローカル配信）し、オフラインでも動くようにする。CDN への実アクセスは iframe の CSP で禁止する。 | MUST |
| FR-X-03-7 | iframe の CSP は `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' <self-bundled>; style-src 'unsafe-inline'; connect-src 'none'; img-src data:` を基本とし、実ネットワークへ出られないことを保証する。 | MUST |

### FR-X-04 エラー／異常系の報告

| ID | 要件 | 優先度 |
|---|---|---|
| FR-X-04-1 | verdict の分類: `CE`（コンパイル・構文エラー）/ `RE`（非0終了・例外）/ `TLE` / `MLE`（exit 137 かつ cgroup の OOM イベント検出）/ `OLE` / `WA` / `AC` / `IE`（基盤側障害）。 | MUST |
| FR-X-04-2 | コンパイラ診断を構造化して Monaco のマーカー（行・列・メッセージ・重大度）に変換する。取得手段: gcc `-fdiagnostics-format=json`、rustc `--error-format=json`、tsc `--pretty false` の行パース、go build / python traceback / php Parse error は正規表現。 | MUST（C/Rust/TS は JSON、他は正規表現） |
| FR-X-04-3 | TLE 時は「どのテストケースで」「何秒で打ち切ったか」「stdout が途中まであるか」を表示し、「無限ループの可能性」のヒントを添える。 | SHOULD |
| FR-X-04-4 | stdout は実行中にストリーミング表示する（SSE または WebSocket）。コンパイル言語では「コンパイル中…」「実行中…」のフェーズ表示を行う。 | SHOULD |
| FR-X-04-5 | 基盤障害（Docker 未起動、イメージ無し、exec 失敗）は `IE` として採点に含めず、再試行ボタンと原因を表示する。 | MUST |
| FR-X-04-6 | 実行ごとの生ログ（コマンド、exit code、所要時間）をセッションログに残す。録画タイムラインに「実行イベント」としてマークする。 | MUST |

### FR-X-05 Docker イメージ

| ID | 要件 | 優先度 |
|---|---|---|
| FR-X-05-1 | 言語ごとに 1 イメージ（計 6: c, rust, python, go, node, php。HTML/CSS/JS はイメージ不要）。ベースタグはメジャー.マイナーまで固定し、ダイジェストで pin する。 | MUST |
| FR-X-05-2 | 全イメージ arm64 でビルド可能（amd64 もマルチアーチで用意するが v1 では非必須）。 | MUST（amd64 は COULD） |
| FR-X-05-3 | Go はモジュールキャッシュ／ビルドキャッシュ、Rust は標準ライブラリの rlib を**イメージ内で事前に温めておく**（hello world を一度ビルドしておく）。 | MUST |
| FR-X-05-4 | イメージはアプリ側が管理する `compose.yml` から起動し、ユーザが `docker` を直接触らなくて済む。初回のみ pull/build（ビルドを避け GHCR 等から pull できるようにするのは COULD）。 | SHOULD |
| FR-X-05-5 | `python` イメージに numpy 等の追加は入れない（面接練習の範囲外。入れるなら問題定義の `requires` で宣言し別イメージ）。 | MUST |

---

## 非機能要件

| 項目 | 目標値 | 備考 |
|---|---|---|
| 実行レイテンシ（インタプリタ言語、Run 押下→stdout 先頭） | p50 ≤ 0.5 s、p95 ≤ 1.5 s | ウォームコンテナ + `docker exec` 前提。OrbStack の方が Docker Desktop より exec/ファイル I/O が速い傾向（要確認・実測必須） |
| 実行レイテンシ（コンパイル言語） | C ≤ 1.5 s、Rust/Go ≤ 3 s（p95、単一ファイル） | Rust は `rustc` 直接 + `-C opt-level=0`、Go は GOCACHE 永続で達成見込み（要確認） |
| ウォームコンテナ再作成 | ≤ 2 s | TLE/OOM 後の復帰 |
| アイドル時の常駐コスト | 6 コンテナ合計 RSS ≤ 300 MB | `sleep infinity` で待機、CPU 0 |
| ディスク | 全イメージ合計 ≤ 3 GB | 目安: python-slim 150 MB、node-slim 200 MB、php-cli 150 MB、gcc 300〜400 MB、golang 300 MB、rust 1 GB 強（要確認） |
| 初回セットアップ | pull 合計 ≤ 10 分（100 Mbps） | 進捗表示必須（FR-X-01-9） |
| 安全性 | 外部ネットワーク到達 0、ホスト FS へのマウント 0、ホスト CPU 占有 ≤ 2 コア | iframe は CSP で `connect-src 'none'` |
| オフライン動作 | Docker イメージ取得後は完全オフラインで動く | Tailwind もローカル配信 |
| 再現性 | 同一コード・同一テストで verdict が一致する | 時間計測は ±20% のブレを許容し、TLE 閾値に 1.5 倍のマージンを設ける |
| ログ保存 | 実行 1 回あたり ≤ 50 KB（stdout は切り詰め）、スクショ ≤ 300 KB | セッション 20 分で数十回実行しても数 MB |

---

## 言語別実行方式比較表

### 候補となる実行基盤

| 方式 | 起動レイテンシ | リソース制限 | 安全性（本件の脅威モデル） | Mac での現実性 | 判定 |
|---|---|---|---|---|---|
| Docker `docker run` 毎回 | 0.3〜1.0 s 追加（Docker Desktop の VM 越しではさらに遅い傾向、要確認） | cgroup で十分 | 十分 | 容易 | 1.5 s 目標に対し余裕がない。**不採用（フォールバックのみ）** |
| Docker ウォームコンテナ + `docker exec` | 数十〜百数十 ms（要確認） | コンテナ単位の cgroup + 実行ごとの `timeout`/`ulimit` | 十分。暴走時はコンテナごと捨てる | 容易 | **v1 採用** |
| WebAssembly ブラウザ内（Pyodide, esbuild-wasm, php-wasm 等） | 初回ロードが数秒（Pyodide は ~10 MB 超、要確認）、以降 ~0 | ブラウザタブのメモリに依存、CPU 制限は Worker 強制終了で代替 | 最良（ブラウザサンドボックス） | 容易だが言語ごとに成熟度差 | Python/TS/JS では補助として有用。採点の正本には使わない |
| nsjail（Docker 内で二重に隔離） | exec と同程度 | 細粒度 | 過剰 | Linux 専用だがコンテナ内なら動く。ビルドが面倒 | v1 では**不要** |
| gVisor (runsc) | run より遅い | 十分 | 過剰 | Docker Desktop for Mac での runsc 利用は公式サポート外（要確認） | 不採用 |
| Firecracker / microVM | 100 ms 級だが KVM 必須 | 十分 | 過剰 | macOS 直接では動かない | 不採用 |
| Apple `container`（macOS 26 の VM-per-container） | 1 s 弱と推定（要確認） | VM 単位 | 十分 | macOS 26 以降のみ、エコシステム未成熟 | 将来検討 |

### 言語別の決定

| 言語 | v1 実行方式 | コマンド概要 | 想定レイテンシ | 留意点 |
|---|---|---|---|---|
| C | Docker warm (`gcc` イメージ) | `gcc -O1 -std=c17 -fdiagnostics-format=json main.c -o a.out && ./a.out < in` | 0.3〜0.8 s | `-fsanitize=address,undefined` を Run 時のみ有効にすると RE の原因表示が良くなる（SHOULD）。math は `-lm` 常時付与 |
| Rust | Docker warm (`rust` イメージ) | `rustc --edition 2021 -C opt-level=0 --error-format=json main.rs` | 1〜3 s（要確認） | cargo は使わない（依存解決・ビルド時間が目標を超える）。`--test` でユニットテスト型を実現 |
| Python | Docker warm (`python:3.12-slim`)、Run は Pyodide も可（COULD） | `python3 -I -u main.py < in` | 0.1〜0.3 s | `-I` で cwd のインポート汚染防止。Pyodide は stdin の扱いと一部標準ライブラリの差異があるため採点に使わない |
| Go | Docker warm (`golang` イメージ) | `go build -o app . && ./app < in`、GOCACHE/GOMODCACHE をイメージ内に事前生成 | 0.5〜2 s（要確認） | `go run` はキャッシュが効きにくいので build+run。`go vet` は走らせない |
| TypeScript (Node) | Docker warm (`node:22-slim`) | `node --experimental-strip-types main.ts`（Node 22.6+、要確認）、不可なら `tsx` 同梱 | 0.2〜0.5 s | 型検査はエディタ側のみ。実行時エラーの行番号は source map が無いとずれる可能性（要確認） |
| TypeScript (ブラウザ) | ブラウザ内 esbuild-wasm → iframe | トランスパイル後 `<script type="module">` として srcdoc に埋める | 0.1 s 以下 | DOM 問題向け。`import` は許可しない（バンドル不要） |
| HTML/CSS/JS | ブラウザ内 iframe（Docker 不要） | srcdoc + sandbox + CSP + fetch シム + Tailwind ローカル配信 | 即時 | スクショは `html2canvas` では不正確になりやすい。SHOULD 要件では Playwright コンテナ（別イメージ、約 1 GB、要確認）で撮る方式を検討 |
| PHP | Docker warm (`php:8.3-cli`) | `php -d display_errors=stderr main.php < in` | 0.1〜0.3 s | Web 向け問題（フォーム処理など）は `php -S` 常駐ではなく CLI で `$_GET` を注入するハーネスにとどめる。php-wasm はブラウザ内 Run の候補だが v1 では見送り |

---

## 実行プロトコル（API 案）

ローカル Next.js のサーバ側に「Runner サービス」を置く。クライアントは HTTP + SSE。

### エンドポイント

```
POST /api/run              # 採点なしの実行（Run）。sample テストの有無は任意
POST /api/judge            # 問題IDに紐づく全テストで採点（Submit）
GET  /api/run/{runId}/events   # SSE: phase / stdout / stderr / result
POST /api/run/{runId}/cancel
GET  /api/sandbox/status   # Docker 稼働、イメージ有無、各言語コンテナの状態
POST /api/sandbox/warm     # 言語を指定してコンテナを起動（アプリ起動時・問題選択時に呼ぶ）
```

### リクエスト（/api/run, /api/judge 共通）

```json
{
  "problemId": "web-search-cache-001",
  "language": "python",
  "files": [{ "path": "main.py", "content": "..." }],
  "entry": "main.py",
  "stdin": "3\n1 2 3\n",
  "sessionId": "sess_20261024_1530",
  "mode": "run"
}
```

### SSE イベント

```
event: phase    data: {"phase":"queued"|"compiling"|"running"|"judging","caseIndex":0}
event: stdout   data: {"chunk":"...","caseIndex":0}
event: stderr   data: {"chunk":"...","caseIndex":0}
event: case     data: {"caseIndex":0,"verdict":"AC","timeMs":12,"memKb":9800}
event: result   data: { ...最終結果（下記） }
```

### 最終結果

```json
{
  "runId": "run_01HX...",
  "verdict": "WA",
  "summary": { "total": 6, "passed": 4, "timeMsMax": 120, "memKbMax": 15200 },
  "compile": {
    "ok": true,
    "diagnostics": [
      { "file": "main.rs", "line": 12, "col": 9, "severity": "warning", "message": "unused variable `x`" }
    ],
    "rawStderr": "..."
  },
  "cases": [
    {
      "index": 2, "name": "hidden-02", "visibility": "hidden",
      "verdict": "WA", "timeMs": 8, "memKb": 9900, "exitCode": 0,
      "stdoutHead": "41\n", "expectedHead": "42\n",
      "diff": "@@ -1 +1 @@\n-42\n+41"
    }
  ],
  "behavior": {
    "requests": [{ "ts": 1200, "url": "https://api.example.com/search?q=lorem", "aborted": false }],
    "observed": ["empty-skip", "dedupe"],
    "missing": ["abort"]
  },
  "screenshots": ["sessions/sess_.../run_01HX.png"],
  "infra": { "backend": "docker-exec", "image": "livecode/python@sha256:...", "containerRestarted": false }
}
```

### サーバ内部の実行手順（Docker 系）

1. `files` を一時ディレクトリに書き出し、`docker cp`（または exec + tar stdin）でコンテナの `/work/<runId>/` に配置。
2. `docker exec -u runner -w /work/<runId> <ctr> /opt/runner/run.sh <lang> <phase>` を呼ぶ。`run.sh` が `timeout -s KILL`、`ulimit -v/-f/-u`、`prlimit` を適用して実行。
3. stdout/stderr をストリームで受け取りつつ 1 MiB 超で kill。exit code と `/sys/fs/cgroup/memory.events` の oom_kill を読んで verdict 判定。
4. ケースごとに 2〜3 を繰り返し（コンパイルは 1 回）、終了後 `/work/<runId>` を削除。TLE/OOM 発生時はコンテナを `rm -f` → 再 `run`。

### iframe 系（HTML/CSS/JS, ブラウザ TS）

1. 親が `srcdoc` を組み立てる: CSP メタ → fetch シム → Tailwind ローカルスクリプト → ユーザ HTML → 採点スクリプト（Submit 時のみ）。
2. 親と iframe は `postMessage` で `{type:"request"|"assert"|"log"|"error"|"ready"}` をやり取り。
3. 採点スクリプトがシナリオステップ（`type`/`click`/`wait`/`expect*`）を実行し、結果を親に返す。親は結果 JSON を Docker 系と同じ形式で `/api/judge/record` に保存する（採点自体はクライアントで実施してよい。単一ユーザなので改ざん対策は不要）。

---

## 問題テスト定義スキーマ（JSON 例）

問題ディレクトリ: `problems/<id>/problem.json`、`statement.md`、`tests/`、`harness/<lang>/`。

### 例 1: stdin/stdout 判定（多言語共通）

```json
{
  "id": "algo-two-sum-001",
  "kind": "stdio",
  "languages": ["c", "rust", "python", "go", "typescript", "php"],
  "limits": { "timeMs": 2000, "wallMs": 5000, "memoryMb": 256, "outputKb": 1024 },
  "compare": { "mode": "token", "floatAbs": 1e-6, "floatRel": 1e-6 },
  "stopOn": { "consecutiveTle": 2 },
  "cases": [
    { "name": "sample-1", "visibility": "sample", "stdinFile": "tests/01.in", "expectedFile": "tests/01.out" },
    { "name": "hidden-1", "visibility": "hidden", "stdin": "5\n1 2 3 4 5\n", "expected": "15\n", "limits": { "timeMs": 500 } }
  ]
}
```

### 例 2: ユニットテスト型（言語ごとにハーネス）

```json
{
  "id": "ds-lru-cache-002",
  "kind": "unit",
  "languages": ["python", "go", "typescript", "rust"],
  "limits": { "timeMs": 3000, "memoryMb": 256 },
  "harness": {
    "python":     { "files": ["harness/python/test_lru.py"], "command": "python3 -I -m unittest -v test_lru" },
    "go":         { "files": ["harness/go/lru_test.go", "harness/go/go.mod"], "command": "go test -run . -v ./..." },
    "typescript": { "files": ["harness/ts/lru.test.ts"], "command": "node --experimental-strip-types --test lru.test.ts" },
    "rust":       { "files": ["harness/rust/tests.rs"], "command": "rustc --test -o t main.rs && ./t" }
  },
  "userEntry": { "python": "lru.py", "go": "lru.go", "typescript": "lru.ts", "rust": "main.rs" },
  "resultParser": "tap|go-test-json|unittest-verbose|rust-test"
}
```

### 例 3: Pixiv 型（DOM + シナリオ + モック API）

```json
{
  "id": "web-search-cache-001",
  "kind": "web",
  "languages": ["html"],
  "timeLimitMin": 20,
  "preview": {
    "tailwind": "local",
    "csp": "strict-offline",
    "viewport": { "width": 800, "height": 600 }
  },
  "mockApi": {
    "routes": [
      {
        "match": { "method": "GET", "urlPattern": "^https://api\\.example\\.com/search\\?q=(.*)$" },
        "latencyMs": [300, 800],
        "failRate": 0,
        "respond": {
          "byQuery": {
            "": [],
            "lorem": [{ "id": 1, "title": "Lorem ipsum" }, { "id": 2, "title": "Dolor" }],
            "sit":   [{ "id": 3, "title": "Sit amet" }]
          },
          "default": [{ "id": 4, "title": "Consectetur adipiscing elit" }]
        }
      }
    ],
    "unmatched": "block"
  },
  "layout": [
    { "name": "input-button-inline", "assert": "sameRow", "selectors": ["input", "button"] },
    { "name": "results-below", "assert": "below", "selectors": ["div[data-results], div:has(> *:nth-child(2))", "input"] }
  ],
  "scenarios": [
    {
      "name": "basic-render",
      "steps": [
        { "type": "input", "value": "lorem" }, { "click": "button" }, { "waitForRequestsSettled": 2000 },
        { "expectText": { "selector": "div", "contains": ["Lorem ipsum", "Dolor"] } }
      ]
    },
    {
      "name": "empty-query-skips-request",
      "steps": [ { "type": "input", "value": "" }, { "click": "button" }, { "wait": 500 }, { "expectRequests": { "count": 0 } } ]
    },
    {
      "name": "same-query-cached",
      "steps": [
        { "type": "input", "value": "sit" }, { "click": "button" }, { "waitForRequestsSettled": 2000 },
        { "click": "button" }, { "wait": 500 },
        { "expectRequests": { "count": 1, "url": "q=sit" } }
      ],
      "tags": ["dedupe"]
    },
    {
      "name": "rapid-clicks-abort-or-dedupe",
      "steps": [
        { "type": "input", "value": "lorem" }, { "click": "button", "times": 5, "intervalMs": 50 },
        { "waitForRequestsSettled": 3000 },
        { "expectRequests": { "completedMax": 1, "allowAborted": true } }
      ],
      "tags": ["abort", "debounce"],
      "weight": 2
    }
  ],
  "screenshot": { "after": ["basic-render"], "format": "png" },
  "rubricHints": ["empty-skip", "dedupe", "abort", "ttl", "lru"]
}
```

スキーマ上の共通ルール:
- `kind` ∈ `stdio | unit | web`。`web` は Docker を使わない。
- `limits` は問題既定 → ケース個別の順で上書き。言語別係数（例: Python ×3、PHP ×3、TS ×2）は Runner 側の設定で掛ける。
- `expected*` と `stdin*` は inline と `*File` の両方を許可。大きい入力はファイル。
- `tags` / `rubricHints` は採点に直接は使わず、Claude の講評プロンプトへ渡すメタデータ。

---

## リスクと反論

| # | リスク／反論 | 対応 |
|---|---|---|
| R1 | 「Docker 必須は導入障壁が高い。全部 Wasm で良いのでは」 | C/Go/Rust/PHP をブラウザ内でネイティブ同等に動かす Wasm ツールチェーンは成熟度・サイズ・デバッグ性でばらつきが大きく、6 言語分を自前で保守するコストが Docker より高い。Python/JS/TS だけ Wasm にすると採点環境が二重化し verdict の再現性が落ちる。Docker を正本とし、Wasm は「Run の高速化」に限定する。 |
| R2 | ウォームコンテナ方式は、ひとつの実行の残骸（バックグラウンドプロセス、/tmp 書き込み）が次の実行に漏れる | 実行ごとに `/work/<runId>` を分け、終了時に削除。異常終了時はコンテナを捨てる（FR-X-01-4）。正常終了後も `pids` が残っていれば捨てる。単一ユーザなので情報漏洩としての重大度は低い。 |
| R3 | exec 単位ではメモリ制限がコンテナ全体にしか効かず、MLE を正確に判定できない | 同時実行を言語ごと 1 に制限（FR-X-01-5）すれば「コンテナの OOM = その実行の OOM」とみなせる。`ulimit -v` で仮想メモリも併用する（Go/JS の仮想メモリ確保が大きい点は言語別に閾値調整、要確認）。 |
| R4 | Docker Desktop for Mac の VM 越し I/O で `docker cp` が遅く、1.5 s を割る | ファイルは数 KB なので `exec` の stdin 経由で tar 投入すれば VM の共有 FS を経由しない。実測して Docker Desktop と OrbStack の差を README に記載。 |
| R5 | Rust の初回コンパイルが 3 s を超える | `rustc` 直接・opt-level 0・std の事前温め。それでも超えるなら「Rust はコンパイル中表示を出す」ことで UX として吸収し、目標値を言語別に緩める。cargo 対応は v2。 |
| R6 | fetch シムは「本物の fetch を使った」実装と挙動が微妙に違う（Response のストリーム、`signal` の扱いなど） | シムは `Response` オブジェクトを本物の `new Response(JSON.stringify(...))` で生成し、`signal.aborted` を監視して `AbortError` を投げる。XHR・axios・jQuery も fetch/XHR どちらかを使うのでシムの層で網羅できる。Service Worker 方式は `sandbox` iframe で登録できないため採らない。 |
| R7 | 「サーバへの優しさ」の自動採点は、設計意図を汲めず誤判定する（例: debounce を入れたら 5 連打でも 1 回だが、abort は無い） | シナリオは「何回届いたか」のみを判定し、どの手法で達成したかは `observed` タグとして記録、最終評価は Claude に委ねる（FR-X-03-5）。自動採点は補助指標に留める。 |
| R8 | スクリーンショットを Playwright コンテナで撮ると、Chromium 同梱イメージで 1 GB 増え、起動も遅い | v1 は iframe をユーザの画面録画で十分カバーできる（録画サブシステムが画面を撮っている）。Playwright は COULD に降格し、v1 は `html2canvas` 相当の簡易スクショか「録画フレームの切り出し」で代替する。 |
| R9 | 無限ループ中の JS で iframe がフリーズし、親ページまで固まる | `sandbox` iframe は同一プロセスになり得る（要確認）ため、採点シナリオは Web Worker 化できない。対策: シナリオに壁時計タイムアウトを設け、超過時は iframe を破棄して `TLE` 扱い。ユーザ側の Run も 10 s で自動破棄。 |
| R10 | ネットワーク遮断により `pip install` などができない、と練習中に気づく | 面接本番も「Web 検索不可」なので仕様として明記し、問題文で許可ライブラリを宣言する。 |
| R11 | 問題 500 問分のテストを人手で書けない | スキーマを単純に保ち（`stdio` が大半）、問題生成は Claude に JSON を生成させ、サンプル解答で self-check するパイプラインを別途用意する（本書の範囲外）。 |

---

## v1 スコープ提案

**v1 で実装するもの**
1. Docker ウォームコンテナ + `docker exec` の Runner（C / Python / Go / TypeScript-Node / PHP / Rust の 6 イメージ、compose 管理、arm64 のみ）。
2. `stdio` 判定（exact/token/float）と `unit` 判定（標準ツールのみ）。sample/hidden 区別、SSE ストリーミング、verdict 分類、Monaco マーカー（C/Rust/TS は JSON 診断、他は正規表現）。
3. HTML/CSS/JS の sandbox iframe 実行、CSP オフライン化、Tailwind ローカル配信、fetch/XHR シムとリクエスト計測、操作シナリオ（type/click/wait/expectRequests/expectText/sameRow/below）。Pixiv 問題をそのまま採点できる状態にする。
4. Docker 未起動・イメージ未取得の案内 UI と pull 進捗。
5. 実行結果 JSON のセッションログ保存（MCP 評価エージェント向け）。

**v1 から外すもの（v2 以降）**
- Pyodide / php-wasm によるブラウザ内 Run（UX 改善にはなるが二重環境の保守コストが先に来る）。
- Playwright コンテナによるスクリーンショット・画像差分採点（録画で代替可能）。
- カスタム checker スクリプト、偽装時計による TTL 検証、`failRate` によるエラーハンドリング採点。
- cargo / npm / pip による依存追加、amd64 イメージ、nsjail・gVisor 等の多層隔離。
- Apple `container` 対応。

**v1 の受け入れ条件（抜粋）**
- `print(input())` 相当の Python を Run して、押下から出力まで p95 1.5 s 以内（OrbStack / Docker Desktop 双方で実測、要確認）。
- `while(1);` の C、`vec![0u8; 4<<30]` の Rust、`:(){ :|:& };:` 相当の fork を含む Python を Submit しても、ホストが固まらず 10 s 以内に verdict が返り、次の実行が正常に動く。
- Pixiv 問題のサンプル解答（`search-form.html`）が 4 シナリオ全て pass し、キャッシュ無しの素朴実装が `same-query-cached` で fail する。
- Docker を終了した状態でアプリを開くと実行ボタンが案内に置き換わり、起動後に自動復帰する。

**最初に潰すべき不確実性（実測タスク）**
1. Docker Desktop vs OrbStack での `docker exec` 往復時間と stdin 経由ファイル投入の時間。
2. `rustc` 単一ファイルと `go build` の arm64 コンパイル時間（キャッシュ温め有無）。
3. `node --experimental-strip-types` の対象 Node バージョンでの安定性と、エラー行番号の正確さ。
4. `sandbox` iframe 内の無限ループが親ページに与える影響（プロセス分離の有無）。
