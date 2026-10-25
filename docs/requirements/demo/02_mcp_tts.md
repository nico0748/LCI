# 02 模範解答デモ — データ形式・MCP ツール・検証・音声エンジン・再生駆動（技術レビュー）

対象: 「模範解答をライブコーディング演出＋音声解説で見せる。動画は作らない。台本は Claude が MCP 経由で書く」
担当範囲: DemoScript 形式 / コンパイル（タイミング）/ 検証 / MCP ツール / 音声エンジン / 保存 / 再生クロック / 安全性 / テスト
前提ブランチ: `claude/model-answer-demo`（読み取りのみ。引用は file:line）

---

## 0. 結論（先に）

1. **Claude には位置（行・列）を書かせない。** コード操作は Claude の Edit ツールと同じ `replace {old, new}`（old は一意一致必須）＋ `append` ＋ `write`（全文）の 3 種だけ。アプリが差分を「人間らしい打鍵」（変更行だけ・自動インデント・書記素単位）に展開し、既存の `edit` イベント（Monaco 範囲）にコンパイルする。手元の試作で two-sum の 2 操作 → 171 イベント → `core.applyEdit` で再生した結果が目標と一致（日本語コメント・絵文字のサロゲートペア込み）した。
2. **時刻は Claude に書かせない。** Claude は内容（ナレーション・操作・実行・章）だけを書き、アプリが「ナレーション長 × 打鍵が説明に収まる速度」から決定的に時刻を割り付ける。実音声ができたら実測長で再コンパイルする。参照は時刻ではなく `step_id` を安定アンカーにする。
3. **音声の主経路は macOS `say` を保存時（サーバ側）に区間ごとに合成**し、AAC 32 kbps モノラル m4a で保存する。12 分の実測は 80 区間で 3.0 MB（Opus 24k なら 2.2 MB）。録画 1 本（1 Mbps, `apps/web/src/lib/capture/recorder.ts:162`）の 12 分 ≈ 90 MB の約 1/30。音声は台本から再生成できる**派生キャッシュ**として扱い、消してよい。
4. **フォールバックは「字幕のみ（無音）」を MVP、Web Speech API を v1.1**。Web Speech は容量 0 だが長さが事前に分からず、シークは文単位、Chrome の pause/cancel 周りが不安定で、Node で試験できない。クラウド TTS と VOICEVOX はアダプタとして後から足す。
5. **再生クロックは「区間内は音声が主、区間外は仮想時計」**（DemoClock）。音声ドライバ（音声ファイル / Web Speech / 無音）を差し替え可能にし、どのモードでも同じタイムラインを使う。`CodeAtT` の「150–700ms ごとにサーバから全文を取って差し替える」方式（`apps/web/src/components/review/CodeAtT.tsx:99-127`）は打鍵演出に使えないので、クライアントでイベントを逐次適用する。
6. **検証は保存前に必ず実行**: スキーマ → 操作適用 → 実行ステップと最終コードの判定（既存 runner、Docker サンドボックス）→ タイミング → **デモ自身を既存の `computeMetrics` で採点**（無発話 15 秒超の打鍵ゼロなど）→ talking_points / requirements 網羅 → ナレーション lint。エラーは step_id・原因・直し方・該当箇所の行番号付きコードを返す。
7. **MVP は stdio / unit 問題のみ**（現行 27 問中 20 問）。web 問題はサーバで判定できない（`packages/runner/src/judge.ts:228`、`apps/web/src/app/api/judge/route.ts:31`）ので、ブラウザ側検証を足す v1.1 に回す。
8. **新パッケージ `packages/demo`（core + runner に依存）** に schema / compile / validate / TTS / store を置き、MCP サーバと Next の両方から使う。これは「mcp-server は core と evaluator のみに依存」（`docs/API_CONTRACT.md:39`）の契約変更になるので、追記として明示する。
9. **MCP ツールは 7 本＋プロンプト 1 本＋ガイド resource 1 本**: `list_problems`, `get_problem_for_demo`, `validate_demo_script`(read-only), `save_demo_script`, `list_demos`, `get_demo_script`, `delete_demo`(destructive) ＋ prompt `author_demo`。音声合成は MCP ではなくアプリ側（保存直後にバックグラウンド、または初回再生時）で行う。
10. **保存先は `data/demos/<problem_id>/<language>/<demo_id>/`（git 管理外）**。台本は ~20–60 KB、音声はキャッシュ。問題バンクへの「公式デモ」昇格（台本だけ commit、音声は commit しない）は後回し。
11. **API キーでのアプリ内生成は v1.1**。同じガイド文面・同じ DemoDraft スキーマ・同じ検証器を使う薄い経路として設計だけ揃えておく（1 回 ≈ $0.3、詳細 §6.4）。

---

## 1. 設計を縛る既存コードの事実

| # | 事実 | 根拠 | 設計への影響 |
|---|---|---|---|
| F1 | 編集イベントは Monaco の 1 始まり `[sl, sc, el, ec]`、変更前文書に対する範囲。列は UTF-16 単位 | `packages/core/src/session.ts:76-97`, `timeline.ts:9-30` | コンパイル結果をこの形にすれば `applyEdit` / `reconstructFileAt`（`timeline.ts:41-77`）がそのまま使える。打鍵は書記素単位で切り、サロゲートペアを割らない |
| F2 | `@lci/core/browser` は timeline / session をブラウザ向けに再輸出している | `packages/core/src/browser.ts:1-10` | 再生側のシークもクライアントで `applyEdit` を使える |
| F3 | `CodeAtT` は時刻ごとにサーバで全文を再構成し、Monaco の value を丸ごと差し替える | `CodeAtT.tsx:99-127` | 打鍵演出には不向き。デモ用プレイヤーは `model.applyEdits` で逐次適用する（既存コンポーネントは見た目だけ流用） |
| F4 | レビュー画面は「動画が主クロック＋rAF で t を報告」「動画が無いときは内部クロック」「seek は seekVersion で伝える」 | `VideoPane.tsx:10-16, 96-117`, `ReviewScreen.tsx:124-144` | DemoClock は同じ流儀（主＝メディア、無ければ仮想時計）にする |
| F5 | `TranscriptPane` は `Transcript` 型、編集密度レーンは `Event[]` を受ける | `TranscriptPane.tsx:14-40`, `density.ts:33` | コンパイル結果を `Event[]` ＋ `Transcript` 形のナレーションで出せば、字幕リストと密度レーンを流用できる |
| F6 | 指標計算は `computeMetrics({events, segments, meta, ended_t})`。沈黙閾値 15 秒、talking_points はキーワード検出 | `packages/core/src/metrics.ts:10, 44, 79` | デモ自身を同じ物差しで採点し、「模範が自分の指標で模範でない」事故を防ぐ |
| F7 | web 問題はサーバで採点しない | `judge.ts:218-228`, `api/judge/route.ts:31` | MVP は stdio/unit。web は v1.1（ブラウザの sandbox iframe で検証） |
| F8 | `LCI_RUNNER=fake` はホストで隔離なしに実行する | `packages/runner/src/backend-fake.ts:8-12`, `runner.ts:92-99` | Claude が書いたコードを fake で走らせない。テストだけ `LCI_DEMO_ALLOW_FAKE=1` で許可 |
| F9 | ウォームコンテナ名は固定 `lci-<lang>`、同時実行制御はプロセス内のセマフォ | `languages.ts:24-26`, `runner.ts:38-66` | MCP プロセスと Next が同じコンテナを叩く。録画中セッションがあるときは検証を断る |
| F10 | `problemReference` は参照解を行番号付き（`   1| ...`）で返す | `packages/mcp-server/src/data.ts:56-62, 282-303` | そのまま渡すと Claude が `old` に行番号を混ぜる。デモ用は**生テキスト**を主にし、行番号版は別フィールドにする |
| F11 | MCP の流儀: `json/fail/guard`、zod の inputSchema、`readOnlyHint`、同一プロセス内の参照記録（seen）で手順逸脱を警告 | `server.ts:54-73, 84, 291-295` | 新ツールも同じヘルパと流儀に揃える |
| F12 | 評価は「モデルが書く Draft」と「アプリがメタを足す完成形」を分け、寛容版スキーマで救済する | `packages/evaluator/src/schema.ts:4-12, 89-91, 166-174` | DemoDraft（Claude）/ DemoScript（保存形）に分ける。structured outputs 用の JSON Schema 変換（`schema.ts:94-135`）は共通化して再利用 |
| F13 | ネタバレ制御: 参照解・解説は `?reveal=1` のときだけ返す | `apps/web/src/lib/review/problems-api.ts:19-74` | デモ本体（台本・音声）も reveal 付きでしか返さない |
| F14 | `SessionStore.remove` は id を検査するが `get` / `dir` はしない | `session-store.ts:23-25, 46-47, 59-61` | DemoStore は全メソッドで id を正規表現検査する（同じ穴を作らない） |
| F15 | セッション作成は言語に関係なく全 starter を開く | `apps/web/src/lib/capture/server/sessions-api.ts:48-52` | デモは選んだ言語のファイル 1 本だけ（starter が無い言語は `DEFAULT_ENTRY`、`languages.ts:38-45`。unit は `tests.userEntry[lang]`） |
| F16 | 外部コマンドはシェルを介さない spawn ラッパと、Homebrew パスも探す `which` がある | `packages/evaluator/src/ffmpeg.ts:29-85, 96-103` | `say` / `ffmpeg` / `ffprobe` 呼び出しに再利用 |
| F17 | 面接官 TTS は「エコーで文字起こしが汚れる」ので v2 送り | `docs/requirements/00_overview.md:34`, `04_problems_ux.md:307-311, 461` | デモの再生は録画中に鳴らさない（サーバで 409、タブ間でも検知） |

---

## 2. コード操作の表現: 比較と決定

| 案 | 内容 | LLM の失敗しやすさ | トークン | 打鍵の自然さ | 検証のしやすさ | 判定 |
|---|---|---|---|---|---|---|
| A 位置指定 | `{insert, line, col, text}` | **高い**: 行数え違い、前の操作で位置がずれる、UTF-16 列 | 小 | 指定どおり | 適用は必ず成功するが意図とずれても検出できない | 不採用 |
| B ステップ毎の全文 | 各ステップ後のファイル全文を書かせ、アプリが diff | 低い（適用失敗なし） | **大**（30 行 × 15 ステップで 450 行。FE の 150 行ファイルでは 3,000 行） | diff の取り方次第で不自然（移動が削除＋挿入になる、無関係な行の空白揺れが偽の編集になる） | 最終全文の判定は簡単 | `write` として部分採用 |
| C アンカー置換 | `{old, new}`、old は一意一致必須 | 中: 空白違い・非一意。ただし Claude の Edit/text_editor と同じ意味論で、エラーが具体的に直せる | 小 | 新しく書く部分だけを順に打つので自然 | 不一致・非一意を確実に検出 | **主方式** |

決定: `replace`（主）・`append`（空ファイル・末尾追加）・`write`（初手の骨組みや大改造。diff で打鍵化）の 3 種。`occurrence`（n 番目一致）は数え違いを再導入するので入れない。

打鍵化（humanize）の規則:
1. `replace` は old→new を**行単位 LCS で塊に分け**、各塊で共通接頭辞・接尾辞を落とす（old に文脈行を含めても、打つのは変わった部分だけ）。
2. 削除は「範囲選択を 250ms 見せてから 1 イベントで消す」。10 文字以下は Backspace 相当で 1 文字ずつ。
3. 挿入は `Intl.Segmenter` で書記素に分け、改行直後の行頭空白は改行と同じイベントで入れる（エディタの自動インデント相当）。
4. CRLF は LF に正規化。タブ／空白はそのまま。
5. 打鍵の揺らぎは台本ダイジェストを種にした決定的 PRNG（mulberry32）。同じ台本は毎回同じ再生になる。

---

## 3. スキーマ（`packages/demo/src/schema.ts` 案）

```ts
import { z } from "zod";
import { Axis, Language, Verdict } from "@lci/core";

export const DEMO_SCHEMA_VERSION = "1.0";
export const GUIDE_VERSION = "2026.10-a";
export const LIMITS = {
  scriptBytes: 256 * 1024, steps: 60, chapters: 12, opsPerStep: 12, opText: 6_000,
  sayPerStep: 320, sayTotal: 7_000, readingFactor: 2, fileBytes: 64 * 1024, glossary: 60,
} as const;

/** step / chapter の id。安定アンカー（再コンパイルで時刻が動いても参照が壊れない） */
const LocalId = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/, "英小文字始まり、英小文字・数字・_- の 32 文字以内");

/** text は字幕（インライン `code` のみ可）。reading は TTS に渡す読み（省略時は辞書で自動生成） */
export const Say = z.object({
  text: z.string().min(1).max(LIMITS.sayPerStep),
  reading: z.string().min(1).max(LIMITS.sayPerStep * LIMITS.readingFactor).optional(),
});

/** 位置は書かない。old は現在のファイル内でちょうど 1 回だけ一致すること */
export const CodeOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replace"), old: z.string().min(1).max(LIMITS.opText), new: z.string().max(LIMITS.opText),
             pace: z.enum(["type", "fast", "instant"]).default("type") }),
  z.object({ op: z.literal("append"), text: z.string().min(1).max(LIMITS.opText),
             pace: z.enum(["type", "fast", "instant"]).default("type") }),
  z.object({ op: z.literal("write"), content: z.string().max(LIMITS.fileBytes),
             pace: z.enum(["type", "fast", "instant"]).default("type") }),
]);

/** 実行の演出。結果は保存時に実際に実行して記録したものを再生する（再生時に Docker は不要） */
export const RunAction = z.object({
  mode: z.enum(["sample", "stdin", "judge"]),          // sample=サンプルケース, stdin=任意入力, judge=全ケース
  stdin: z.string().max(4_000).optional(),             // mode=stdin のときだけ
  expect: z.union([Verdict, z.literal("any")]).default("AC"), // 意図的に WA を見せる演出も可（上限あり）
});

export const Step = z.object({
  id: LocalId,
  chapter: LocalId,
  say: Say.optional(),
  code: z.array(CodeOp).max(LIMITS.opsPerStep).default([]),
  /** with=最初の文を言い終えたら打ち始める（既定） / after=言い終えてから / before=打ちながら話す */
  code_timing: z.enum(["with", "after", "before"]).default("with"),
  run: RunAction.optional(),
  highlight: z.object({ find: z.string().min(1).max(400) }).optional(), // 説明中に強調する範囲（一意一致）
  covers: z.array(z.string().max(40)).max(8).default([]),               // talking_points / requirements の id
  pause_after_ms: z.number().int().min(0).max(3_000).optional(),
});

export const Chapter = z.object({
  id: LocalId,
  title: z.string().min(1).max(40),
  phase: z.enum(["requirements", "plan", "implement", "test", "review"]),
  axes: z.array(Axis).max(3).default([]),               // この章が手本になるルーブリック軸
});

/** Claude が書く部分（MCP 入力・structured outputs の対象）。メタや時刻は含めない */
export const DemoDraft = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(300),
  target_minutes: z.number().min(3).max(20).optional(),
  chapters: z.array(Chapter).min(2).max(LIMITS.chapters),
  steps: z.array(Step).min(3).max(LIMITS.steps),
  glossary: z.array(z.object({ term: z.string().min(1).max(40), reading: z.string().min(1).max(80) }))
    .max(LIMITS.glossary).default([]),
  self_check: z.string().max(600),                      // 参照解との違い・この解法の弱点を自己申告
});
export type DemoDraft = z.infer<typeof DemoDraft>;
// 横断チェック（章 id の参照、step id の重複、say/code/run のどれかがある等）は schema ではなく validate で行う。
// .refine は structured outputs の JSON Schema に出せないため（schema.ts:94-135 の sanitize 方針と同じ）。

export const DEMO_ID_RE = /^d_\d{8}T\d{6}_[a-z0-9]{4}$/;

export const RunSnapshot = z.object({
  verdict: Verdict, duration_ms: z.number(), passed: z.number().int(), total: z.number().int(),
  cases: z.array(z.object({ name: z.string(), verdict: Verdict, stdout_head: z.string().max(1_024).optional(),
                            expected_head: z.string().max(1_024).optional() })).max(20),
  stdout_head: z.string().max(2_048).optional(), stderr_head: z.string().max(2_048).optional(),
});

/** 保存形。アプリがメタ・検証結果を埋める */
export const DemoScript = z.object({
  schema_version: z.literal(DEMO_SCHEMA_VERSION),
  demo_id: z.string().regex(DEMO_ID_RE),
  revision: z.number().int().min(1),
  problem: z.object({ id: z.string(), dir: z.string(), title: z.string(), judge_kind: z.enum(["stdio", "unit", "web"]) }),
  language: Language,
  file: z.object({ path: z.string(), base: z.enum(["starter", "empty"]), base_sha256: z.string() }),
  created_at: z.string(),
  author: z.object({ route: z.enum(["mcp", "in_app_api"]), model: z.string(), guide_version: z.string(), prompt_hash: z.string().optional() }),
  draft: DemoDraft,
  validation: z.object({
    validated_at: z.string(), runner_backend: z.enum(["docker", "fake"]),
    final_sha256: z.string(), final_judge: RunSnapshot,
    runs: z.record(z.string(), RunSnapshot),            // step_id → 実行結果
    estimate_ms: z.number().int(), warnings: z.array(z.string()).max(50),
    self_metrics: z.object({ silent_typing_max_s: z.number(), silent_edit_ratio: z.number(), lead_time_median_s: z.number().nullable() }),
  }),
  digest: z.string(),                                   // sha256(正規化 draft + base) — 乱数種・音声キャッシュの鍵
});

/** 音声キャッシュ。区間ファイル名は内容ハッシュなので、変わった区間だけ作り直せる */
export const AudioManifest = z.object({
  engine: z.enum(["say", "fake", "voicevox", "cloud"]), voice: z.string(), rate: z.number(),
  format: z.enum(["m4a", "webm"]), engine_info: z.string().optional(),
  segments: z.array(z.object({ step_id: LocalId, key: z.string().regex(/^[a-f0-9]{16}$/),
                               duration_ms: z.number().int().positive(), bytes: z.number().int() })),
  total_bytes: z.number().int(), generated_at: z.string(),
});
```

コンパイル結果（保存しない。台本＋音声マニフェストからの純関数。クライアントでも計算できる）:

```ts
interface CompiledDemo {
  duration: number;                 // ms
  file: { file_id: "f1"; path: string; language: Language }; initial: string;
  events: Event[];                  // 既存型: snapshot（ref="kf:<step_id>"）/ cursor / edit / run / marker
  narration: Transcript;            // 字幕。segments[].t_start/t_end/text → TranscriptPane を流用できる
  steps: { id: string; chapter: string; t0: number; t1: number;
           say?: { t0: number; t1: number; audio_key?: string }; typing?: { t0: number; t1: number }; run_t?: number }[];
  chapters: { id: string; title: string; phase: string; t0: number }[];
  keyframes: Record<string, string>; // "kf:<step_id>" → ステップ開始時点の全文（reconstructFileAt の resolver に渡す）
  timing_source: "measured" | "estimated";
}
```

---

## 4. コンパイルとタイミング算出

### 4.1 手順
1. **基底テキスト**: 言語の starter（無ければ空）。`base_sha256` を記録し、starter が変わったら台本を「要再検証」にする。
2. **操作適用**: ステップ順に `replace/append/write` を適用し、各ステップ開始時点の全文を keyframe にする。失敗したらその場で検証エラー（§5）。
3. **打鍵化**: §2 の規則で `edit` / `cursor` イベント列（相対時刻つき）を作る。
4. **時刻割付**（下記）→ 絶対時刻の `Event[]` と `narration` を出す。ステップ境界ごとに `snapshot` イベント（ref=`kf:<id>`）を置き、シークは「直前の keyframe ＋そのステップ内のイベント」だけで済むようにする。

### 4.2 時刻割付（ms、ステップ i ごと）
```
dN   = ナレーション長: 実測（音声マニフェスト） or 推定
推定 = 250 + Σ文字(1000 / CPS_JA) + 120×「、」 + 300×「。！？」   // CPS_JA 既定 6.5（読み文字/秒）。声ごとに較正値で上書き
lead = code_timing=="before" ? 0
     : code_timing=="after"  ? dN + 300
     : clamp(dN × 最初の文の文字比, 800, 5000)               // 「何を書くか言ってから打つ」（R7）
C    = pace=type の書記素数、Cf = pace=fast の書記素数、K = 削除の回数、J = カーソル移動の回数
W    = max(0, dN − lead − 300)                                // 説明が覆える打鍵時間
cps  = clamp(C / max(W/1000, 0.001), 6, 25)                   // 説明に収まる速さで打つ。遅すぎ・速すぎは打ち切る
type = C/cps×1000 + 改行数×1.5×(1000/cps) + Cf/60×1000 + K×330 + J×200   // instant は 1 イベント
run  = run があれば (打鍵終了 + 300) に実行開始、表示時間 = clamp(実測 duration_ms, 600, 2500)
end  = max(say 終了, lead + type, run 終了) + (pause_after_ms ?? 450)（章の切れ目は 1200）
無発話打鍵 = (lead + type) − dN    → 3 秒超で W_SILENT_TYPING、15 秒超で E_SILENT_TYPING（metrics.ts:10 と同じ閾値）
```
- 1 イベントの間隔は 33ms 以上（cps が高いときは 2–3 書記素をまとめる）。
- 全体長 D = Σ。`D ≤ min(time_limit×60s, 20 分)` を必須、`target_minutes ±30%` 外は警告。

### 4.3 実音声からのフィードバック
- 検証時は推定値で compile し、Claude には `estimate`（ステップごとの say 秒・打鍵秒・はみ出し秒）を返す。
- 合成後は各区間の実測長（ffprobe、`ffmpeg.ts:96-103`）をマニフェストに書き、**読み込み時に再コンパイル**する。台本は変えない。全体長は ±20% 程度動く前提で UI を作る（固定の総時間を表示しない、または「推定」表示）。
- 声ごとの較正: 初回合成時に固定の較正文を合成して ms/文字を測り `data/demos/_tts/calibration.json` に保存、以後の推定に使う。
- ブックマークや「この章から」リンクは `{step_id, offset_ms}` で持つ（再コンパイルで壊れない）。

---

## 5. 検証パイプライン（`validate_demo_script` と `save_demo_script` が共有）

段階ごとに止め、段階内のエラーは最大 20 件まとめて返す（1 往復で多く直せるように）。

| 段 | 内容 | 主なエラー / 警告 |
|---|---|---|
| P0 入口 | JSON バイト長 ≤ 256KB、problem_id が存在、language ∈ problem.languages、judge_kind が stdio/unit | `E_TOO_LARGE`, `E_UNKNOWN_PROBLEM`, `E_LANGUAGE`, `E_JUDGE_UNSUPPORTED`（web は v1.1） |
| P1 スキーマ | DemoDraft の zod 検証（issue の path をそのまま返す） | `E_SCHEMA` |
| P2 参照整合 | step id 重複、章 id 未定義、say/code/run が全部空、covers の id が talking_points/requirements に無い | `E_DUP_STEP`, `E_UNKNOWN_CHAPTER`, `E_EMPTY_STEP`, `W_UNKNOWN_COVER` |
| P3 操作適用 | old 不一致・非一意・no-op、highlight.find 不一致、最終ファイル ≤ 64KB | `E_OP_NOT_FOUND`, `E_OP_AMBIGUOUS`, `E_OP_NOOP`, `E_HIGHLIGHT_NOT_FOUND` |
| P4 実行 | 各 run ステップをその時点のコードで実行し expect と照合。最終コードを全ケースで判定し AC 必須。意図的な失敗 run は 2 回まで | `E_RUN_EXPECT`, `E_FINAL_JUDGE`, `E_INFRA`（Docker 停止など。Claude の責任ではないと明記） |
| P5 タイミング | §4.2 で割付。無発話打鍵・総時間・1 区間 60 秒超 | `E_SILENT_TYPING`, `E_TOO_LONG`, `W_LONG_SEGMENT`, `W_TOO_SHORT` |
| P6 自己採点 | compile 結果を `computeMetrics`（`metrics.ts:79`）に通す。`silence_gt15s` に editing=true が無いこと、`silent_edit_ratio ≤ 0.2`、最初の章（requirements/plan）に編集が無いこと、run が 1 回以上あること | `E_SELF_METRIC`, `W_NO_TEST_RUN`, `W_CODE_BEFORE_PLAN` |
| P7 網羅 | weight ≥ 2 の talking_points と全 requirements がどこかの `covers` にあり、かつ `detectTalkingPoints`（`metrics.ts:44`）でもナレーションから検出できる | `W_COVERAGE`, `W_COVER_NOT_SPOKEN` |
| P8 ナレーション lint | 合計 ≤ 7,000 字。Markdown 見出し・コードブロック・URL・`[[`（`say` の埋め込みコマンド）禁止。英字識別子・記号（`O(N log N)`, `<=`, `^`）を含むのに reading も glossary も無い | `E_SAY_MARKUP`, `W_READING_MISSING`, `W_SYMBOL_NOT_IN_CODE`（説明した識別子が 30 秒以内にコードへ現れない） |

返却形（`validate` は `isError` にせず `ok:false` で構造化して返す。`save` は不正なら `isError: true`）:

```json
{ "ok": false,
  "errors": [
    { "code": "E_OP_AMBIGUOUS", "step_id": "impl-2", "path": "steps[6].code[0].old",
      "message": "old が 2 箇所（7 行目と 15 行目）に一致しました",
      "hint": "前後の行を old に含めて一意にしてください。直前の状態を context に付けます",
      "context": { "before_numbered": "   5| def main() -> None:\n   6|     data = ...\n   7|     print(-1)\n ...\n  15|     print(-1)" } },
    { "code": "E_FINAL_JUDGE", "message": "最終コードが hidden-max-last で TLE（2000ms 制限）",
      "hint": "N=2×10^5 で二重ループになっていないか確認してください。参照解は O(N)" },
    { "code": "E_SILENT_TYPING", "step_id": "impl-3",
      "message": "説明 6.2 秒に対して打鍵 23.8 秒。無発話の打鍵が 17.6 秒（上限 15 秒）",
      "hint": "say を足すか、ステップを 2 つに分けて書いている内容を説明してください" } ],
  "warnings": [ { "code": "W_READING_MISSING", "step_id": "plan-1", "message": "「O(N^2)」に reading がありません。自動の読み「オーダー エヌ にじょう」を使います" } ],
  "estimate": { "duration_s": 512, "timing_source": "estimated",
                "steps": [ { "id": "impl-3", "t0_s": 301.4, "say_s": 6.2, "typing_s": 23.8, "silent_typing_s": 17.6 } ] },
  "final": { "sha256": "…", "code_numbered": "   1| import sys\n…" },
  "judge": { "verdict": "TLE", "passed": 7, "total": 8 },
  "coverage": { "talking_points": { "tp1": ["plan-1"], "tp2": ["impl-2"], "tp3": [] }, "requirements": { "tie_break": ["impl-2", "test-2"] } } }
```

---

## 6. MCP ツール

### 6.1 ツール表（既存の `json/fail/guard` と zod inputSchema の流儀、`server.ts:54-63`）

| tool | 入力 | 出力 | annotations | 備考 |
|---|---|---|---|---|
| `list_problems` | `category?, judge_kind?, language?, has_demo?, limit?≤200` | `[{id, title, category, difficulty, time_limit_min, languages, judge_kind, demo_supported, demos:[{language, demo_id, revision, duration_s}]}]` | readOnly | 現 MCP には問題一覧が無い（`get_problem_reference` は id 指定のみ） |
| `get_problem_for_demo` | `problem_id, language` | 問題文・制約・requirements・talking_points・rubric_hints・面接官メモ・振り返り解説、`file:{path, base, content(生), content_numbered}`、`reference:{content(生), content_numbered, other_languages}`、`judge:{kind, server_judgeable, sample_cases:[{name, stdin, expected}]}`、`limits`、`guide_version`、既存デモ | readOnly | F10 対策で生テキストを主にする。参照記録（seen）に残す |
| `validate_demo_script` | `problem_id, language, draft: DemoDraft` | §5 の返却形 | readOnly, idempotent | サンドボックスで実行するがデータは書かない。録画中セッションがあれば断る |
| `save_demo_script` | `problem_id, language, draft, demo_id?（既存なら新 revision）, note?` | `{demo_id, revision, url, audio:"pending", warnings}` | readOnly=false | 内部で再検証。validate を同じ digest で呼んでいない／get_problem_for_demo 未参照なら warnings に記録（`server.ts:291-295` と同じ考え方） |
| `list_demos` | `problem_id?, language?` | `[{demo_id, problem_id, language, title, revision, duration_s, timing_source, audio_status, final_verdict, created_at}]` | readOnly | |
| `get_demo_script` | `demo_id, revision?` | `{draft, validation 要約, revisions[]}` | readOnly | 直して再保存するため draft 形で返す |
| `delete_demo` | `demo_id, revision?` | `{deleted: true, freed_bytes}` | destructiveHint | revision 省略で丸ごと削除 |

- Prompt `author_demo(problem_id, language, target_minutes?, focus?)`: ガイド本文＋手順（`get_problem_for_demo` → 下書き → `validate_demo_script` → 直す（最大 4 回）→ `save_demo_script` → URL と `self_check` を短く報告）。既存の `evaluate_session` と同じ登録方法（`server.ts:351-364`）。
- Resource: `lci://guides/demo-authoring`（ガイド markdown、prompt と同一文面）、`lci://demos/{demo_id}/script.json`。
- 音声合成は MCP に置かない。MCP クライアントのツール呼び出しには時間制限があり（要確認）、MCP プロセスはクライアント終了で消える。合成は §8 のアプリ側ジョブが担う。`save` の返却に「アプリを開くと音声を生成します」と書く。

### 6.2 オーサリングガイド（`packages/demo/src/guide.ts`、版付き）の骨子
- 構成: requirements（1–2 分: 入出力・制約の言い換え、仮定の明示）→ plan（全探索の見積もり → 採用案、①②③の宣言、やらないこと）→ implement（宣言順に実装。打つ前に何を書くか言い、書いている間はそれを音読）→ test（実行を予告してから実行、境界値）→ review（計算量・別解・落とし穴）。03 のルーブリック R1–R8 の「5 の状態」（`packages/evaluator/src/prompt.ts:13-54`）を手本の条件として引用する。
- 1 ステップ = 1–3 文・80–250 字・です／ます調・フィラーなし。識別子は text では `` `seen` ``、reading はカナ（「シーン」）。記号は読みで（`k - x` →「ケー マイナス エックス」）。
- `replace` の old は**生テキスト**から一字一句コピー（行番号を含めない）。一意になるまで前後の行を含める。
- 大きな定型部分（入力の読み込み）は `pace: "fast"`、本質部分は `type`。
- 嘘の計算量・存在しない API を言わない。`self_check` に参照解との差と弱点を書く。

### 6.3 「見た」チェック・二重経路
- MCP 経路の Claude が `get_problem_for_demo` を呼ばずに保存した場合は warnings に残す（評価の手順逸脱警告と同じ）。
- 判定は MCP プロセス内の runner で行う。Next 側と同名コンテナを共有するので（F9）、`status: recording` のセッションがあれば `E_BUSY_RECORDING` で断る。

### 6.4 アプリ内「API キーで生成」— v1.1 を推奨
- 同じガイドを system、同じ DemoDraft を structured outputs（`sanitize` の共通化、`schema.ts:94-135`）、同じ validate。失敗したらエラー JSON を次のユーザメッセージに入れて最大 2 回直させる。
- モデルは既存と同じ `claude-opus-5-5`、adaptive thinking、`effort: "high"` 明示、`fallbacks: "default"` ＋ beta `server-side-fallback-2026-07-01`、ストリーミング（`evaluate.ts:17-18, 128-143` と同一）。
- 費用概算: 入力 ≈ 12k tok（ガイド 4k＋問題＋参照解）、出力 ≈ 10–15k tok（日本語 5 千字＋コード＋thinking）。$4/$20 per MTok で 1 回 ≈ $0.05 + $0.2–0.3 ≈ **$0.3**、直し込みで最大 ≈ $1（要確認: 実測で更新）。
- MVP にしない理由: ユーザの要求は MCP 経路。直し込みループは MCP の Claude のほうが自然にやれる。API 経路は「同じ部品の薄い包み」なので後から足せる。

---

## 7. 音声エンジン

### 7.1 比較

| 観点 | (a) Web Speech `speechSynthesis`（再生時） | (b) macOS `say`（保存時→区間ファイル） | (c) クラウド TTS（OpenAI / Google / Azure / ElevenLabs） | (d) ローカルニューラル（VOICEVOX ほか） |
|---|---|---|---|---|
| 容量（12 分） | 0（台本のみ ~50KB） | **実測 3.0 MB**（AAC 32k mono, 80 区間）/ 2.2 MB（Opus 24k） | (b) と同程度 | (b) と同程度 |
| 日本語の質 | macOS の OS 音声（Kyoko / Otoya など）＋ Chrome の「Google 日本語」（ネットワーク音声） | 同じ OS 音声。Enhanced / Premium 版は追加ダウンロード（要確認: O-ren 等の有無と `say -v` での指定可否、Siri 音声は `say -v` で選べない可能性） | 最も自然（ニューラル） | VOICEVOX は日本語の抑揚が良い。キャラクター色が強い |
| 長さの事前把握 | **不可**（推定のみ） | 実測（ffprobe / afinfo） | 実測 | 実測。VOICEVOX は audio_query でモーラ単位の長さも得られる |
| シーク・速度 | 文単位で頭出しのみ。pause/resume と cancel が Chrome で不安定（要確認）。rate は次の発話から | 任意位置・`playbackRate`（ピッチ保持） | 同左 | 同左 |
| 決定性 | 低（環境ごとに声の一覧が違う） | 同一 OS・同一声なら同じ | 版更新で変わる | 版固定なら同じ |
| セットアップ | 不要 | 不要（Mac で動くサーバなので必ずある） | API キー・ネットワーク・課金アカウント | エンジン導入（数百 MB〜、要確認）、localhost:50021 |
| 費用 | 0 | 0 | 1M 文字あたり概ね $15–30 → 1 デモ（5 千字）≈ $0.1（要確認） | 0 |
| プライバシー | ローカル（Google 日本語音声のみ外部） | ローカル | 送るのは Claude が書いた解説文で個人情報ではない。主な問題は鍵とネットワーク | ローカル |
| ライセンス | — | 個人のローカル利用。生成音声の再配布はしない前提（要確認） | 各社規約 | 声ごとに規約・クレジット表記（例「VOICEVOX:ずんだもん」）（要確認） |
| Linux CI で試験 | 不可 | 不可 → fake エンジンで代替 | モック | モック |
| 判定 | v1.1 のフォールバック | **主経路（MVP）** | v2 のアダプタ（任意） | v1.1 のアダプタ候補 |

推奨の理由: サーバは Mac 上で動くので `say` は常にある。Web Speech と同じ声を使えるのに、長さが確定し、正確にシークでき、速度変更に強い。容量は動画の約 1/30 で、しかも台本から作り直せるキャッシュなので、ユーザの「容量が増えるのは嫌」に正面から答えられる（全問題・2 言語でデモを作っても音声は消せる）。

### 7.2 合成パイプライン（`packages/demo/src/tts/`）
```
interface TtsEngine { id: "say"|"fake"|"voicevox"|"cloud"; voices(): Promise<Voice[]>;
  synth(reading: string, opts: {voice, rate}, outFile: string): Promise<{duration_ms: number}> }
```
1. 区間キー = `sha256(engine|voice|rate|正規化 reading).slice(0,16)`。既にあれば作らない（台本修正時は変わった区間だけ作り直す）。
2. `say -v <voice> -r <rate> -f <tmp.txt> -o <tmp.aiff>`。**読みはファイル経由で渡す**（先頭が `-` の文字列がオプション扱いになるのを防ぐ）。spawn はシェルを介さない（`ffmpeg.ts:52-85`）。`[[` `]]` は事前に除去（`say` の埋め込みコマンド）。
3. `ffmpeg -i tmp.aiff -af loudnorm -ac 1 -c:a aac -b:a 32k -movflags +faststart <key>.m4a`。ffmpeg が無ければ `say` の m4a 直接出力（`--file-format=m4af --data-format=aac`、要確認）。
4. 長さは `probeDurationMs`（`ffmpeg.ts:96-103`）、無ければ `afinfo`。マニフェストを tmp→rename で原子的に書く。
5. 声の一覧は `say -v '?'` から `ja_JP` 行を抜く。既定は Kyoko、設定で変更可。
6. 実行主体はアプリ: `POST /api/demos/[id]/audio`（冪等、ロックファイル、進捗はポーリング）と CLI `pnpm demo:tts <demo_id>`。保存直後にアプリが起動していれば自動で開始。

### 7.3 読み（発音）
- `say.text`（字幕）と `say.reading`（TTS）を分ける。Japanese 音声が英字識別子をどう読むかは不安定（要確認）なので、ガイドで reading を書かせる。
- reading が無いときは「台本の glossary → 組み込み辞書 → そのまま」の順で自動生成。組み込み辞書の例: `O(N log N)`→オーダー エヌ ログ エヌ、`O(N^2)`→オーダー エヌ にじょう、`2×10^5`→に かける じゅうの ごじょう、`<=`→以下、`!=`→ノットイコール、`dict`→ディクト、`Map`→マップ、`None`→ナン、`-1`→マイナス いち。既存のカタカナ対応表（`prompt.ts:97-107`）の逆引きも入れる。

---

## 8. 再生の駆動（クライアント）

### 8.1 DemoClock
```
interface VoiceDriver {               // 区間（ステップの say）を鳴らす
  prepare(seg): void                  // 次の 2 区間を先読み
  play(seg, offsetMs, rate): Promise<void>   // 実際に鳴り始めたら resolve
  pause(): void; stop(): void
  position(): number | null           // 区間内の再生位置（ms）。分からなければ null
  onEnded(cb): void
}
実装: AudioFileVoice（MVP。<audio> 2 本のプールを交互に使う）/ SilentVoice（MVP。字幕のみ）/ WebSpeechVoice（v1.1。文ごとの utterance）
```
- 区間の中では**音声の再生位置が主**（t = seg.t0 + position）。区間の外（打鍵だけ・実行表示・間）は rAF の仮想時計（dt × rate）。`VideoPane` / `ReviewScreen` と同じ流儀（F4）。
- 区間の開始時は `play()` が鳴り始めるまで t を seg.t0 で止める（最大 1.5 秒。超えたら無音で進め、字幕モードに落とす）。声と打鍵が先にずれるより、全体が数百 ms 延びるほうが良い。
- 速度: 0.75 / 1 / 1.25 / 1.5 / 2。`audio.playbackRate`（ピッチ保持は既定で有効）、仮想時計は dt × rate。コンパイルし直さない。
- シーク: 声を止め、`kf:<step>`（直前のステップ開始の全文）＋そのステップ内のイベントでエディタを作り直す（`reconstructFileAt` に keyframe の resolver を渡せば既存関数で済む）。区間内なら `currentTime = (t − seg.t0)/1000` で頭出し。
- 再生中のエディタ更新は `model.applyEdits` で逐次（value の差し替えはしない。スクロールと疑似カーソルを保つ）。疑似カーソル・選択は decoration で描く。
- Web Speech（v1.1）: 文ごとに utterance を出す（長い utterance が途中で切れる Chrome の既知問題を避ける、要確認）。推定時刻に達しても `end` が来なければ時計を止めて待つ（推定の 1.8 倍で打ち切り）。シークは文頭にスナップ。
- 自動再生: 最初の再生ボタン押下で 2 本の `<audio>` を play→pause して解錠する（Chrome はユーザ操作後なら以後の play を許可。Safari は要確認）。

### 8.2 再生時に必要なもの
- 台本（reveal 付き）＋音声マニフェスト＋区間ファイル（Range 対応配信。`sessions-api.ts:85-141` の実装を流用し、ディレクトリ外を拒否）。
- 実行結果は保存時の RunSnapshot を出す。**再生に Docker は要らない。**

---

## 9. 保存レイアウトと API

```
data/demos/                                   # data/ は git 管理外（.gitignore:4）
  _tts/calibration.json                       # 声ごとの ms/文字
  <problem_id>/<language>/<demo_id>/
    demo.json                                 # {demo_id, problem_id, language, title, current_revision, revisions[], created_at}
    rev-0003.json                             # DemoScript（draft＋validation＋RunSnapshot）。revision は最新 10 件まで
    audio/<engine>-<voice>-r<rate>/
      manifest-rev-0003.json                  # AudioManifest
      3f9c0a1b2c3d4e5f.m4a …                  # 区間（内容ハッシュ名。revision 間で共有、参照の無いものは保存時に掃除）
```
- 書き込みは tmp→rename（`session-store.ts:37-43` と同じ）。
- 上限: 1 デモの音声 ≤ 8 MB、全体 `LCI_DEMO_AUDIO_MAX_MB`（既定 500）を超えたら古い音声から消す（台本は消さない）。
- 公式デモへの昇格（後回し）: `pnpm demo:promote <demo_id>` が draft だけを `problems/<dir>/demos/<lang>.json` に `review.reviewed_by` 付きで書く。音声は commit しない（容量と声の再配布の両面）。
- Route Handlers（案。UI のルート名は UX 側と調整）:
  - `GET /api/demos?problem_id=&language=` → メタだけ（タイトル・長さ・状態）
  - `GET /api/demos/[demo_id]?reveal=1` → DemoScript＋AudioManifest（reveal 無しは 403）
  - `GET /api/demos/[demo_id]/audio/[key]` → m4a（Range）
  - `POST /api/demos/[demo_id]/audio` → 合成開始（冪等）、`GET` で進捗 `{done, total}`
  - `DELETE /api/demos/[demo_id]`
  - 録画中のセッションがある間、`?reveal=1` と音声配信は 409（ネタバレとマイクへの回り込み防止）

---

## 10. セキュリティ・堅牢性

- **ID とパス**: demo_id は `DEMO_ID_RE`、problem_id は `ProblemMeta.id` の正規表現（`problem.ts:69`）＋読み込み済み問題に存在すること、language は `Language` 列挙（`problem.ts:25`）＋ problem.languages に含まれること、音声キーは 16 桁 hex。全部通ったあとでも `path.resolve(...)` が `data/demos/` 配下かを確認する（`sessions-api.ts:94-98`, `problems-api.ts:40-41` と同じ）。DemoStore は get/list/delete すべてで検査する（F14 の穴を作らない）。ファイルパスはサーバが決め、Claude には選ばせない（`isSafePath` も併用、`languages.ts:123-127`）。
- **サイズ**: §3 の LIMITS を zod の `max` で持ち、入口で JSON バイト長も見る。RunSnapshot の stdout は 1–2 KB に切る。
- **コード実行**: Claude が書いたコードは runner（Docker: network none・読み取り専用 rootfs・資源制限、00 D7）でのみ実行。`LCI_RUNNER=fake` では検証を拒否（`E_UNSAFE_BACKEND`）、テストだけ `LCI_DEMO_ALLOW_FAKE=1`。web 問題（v1.1）は既存の sandbox iframe でのみ動かし、プレイヤー本体のページで eval しない。
- **TTS への注入**: reading はファイル渡し、`[[ ]]` 除去、制御文字除去、1 区間 ≤ 640 字、合成タイムアウト 60 秒/区間。
- **字幕表示**: インライン `code` 以外の Markup は解釈しない。HTML は描画しない（`dangerouslySetInnerHTML` 禁止）。
- **ネタバレ**: デモは参照解そのもの。メタは常に見せてよいが中身は reveal 必須。セッション中の画面からは到達させない（UX 側と合意が必要）。
- **競合**: 合成はデモ単位のロックファイル。MCP と Next が同時に `save` しても revision 番号は demo.json をロックして採番する。

---

## 11. テスト計画（macOS の `say` が無い Linux CI で回るもの）

この環境で確認したこと: `say` / espeak / piper は無い。ffmpeg（aac・libopus エンコーダあり）、python3、node 22 はある。`createRunner("fake")` で two-sum の参照解（python）が AC 8/8、starter が WA 2/8（各 200–300ms）。`Intl.Segmenter` は Node 22 で使える。

| 対象 | テスト | 依存 |
|---|---|---|
| schema | two-sum の正しい台本フィクスチャが通る／各 LIMITS 超過が落ちる／id 正規表現 | なし |
| ops | 不一致・非一意（行番号つき context）・no-op・空白違いのヒント・CRLF・`write` の diff | なし |
| compile | **再生一致の性質テスト**: 乱数の操作列を当て、各ステップ境界で「イベントを `core.applyEdit` で再生した全文 == 操作を直接適用した全文」（試作で確認済みの方式）。絵文字・結合文字・日本語。2 回 compile してバイト一致（決定性） | core |
| timing | 無発話打鍵 3 秒 / 15 秒の境界、`code_timing` 3 種、実測長での上書き、総時間上限 | なし |
| 自己採点 | 良いフィクスチャで `silence_gt15s` editing=true が 0、悪いフィクスチャで `E_SELF_METRIC` | core.computeMetrics |
| validate | `LCI_RUNNER=fake LCI_DEMO_ALLOW_FAKE=1` で AC / TLE（二重ループ版）/ expect=WA 演出。fake で許可フラグ無しなら拒否。web 問題は `E_JUDGE_UNSUPPORTED` | runner(fake), python3 |
| TTS | **FakeTts**: 推定長ぶんの無音 WAV を純 JS で書く（ffmpeg 不要）→ マニフェスト、変わった区間だけ再生成されること、掃除。ffmpeg があれば AAC 変換と ffprobe 長さも確認。`say` アダプタは `{ skip: !(await which("say")) }` で Mac のみ | なし / ffmpeg 任意 |
| store | `../`, `%2e%2e`, 絶対パス, NUL, 全角ドット, 長すぎる id を拒否。tmp→rename、revision の刈り込み | fs |
| MCP | 既存の stdio スモーク（`mcp.test.ts:53-134`）を拡張: ツール一覧、`get_problem_for_demo` の `content` に行番号が混ざらない、validate の構造化エラー（`isError` でない）、save → list → get → delete | runner(fake) |
| 再生クロック | DemoClock を時刻源注入の純 TS で試験: 鳴り始めの待ち、区間終了、シーク（区間内・外）、速度、FakeVoice の失敗→字幕モード | なし |
| 手動（Mac） | `say -v '?'` の ja_JP 一覧、Kyoko / Otoya の識別子の読み、1.5×/2× の聞こえ方、Chrome の解錠、12 分デモの合成時間 | Mac |

---

## 12. MVP と後回し

**MVP**
- `packages/demo`: schema / ops / humanize / compile / timing / validate（stdio・unit）/ 自己採点 / DemoStore / TTS（say ＋ fake）/ ガイド
- MCP: 7 ツール＋ `author_demo` ＋ ガイド resource（`docs/API_CONTRACT.md` に依存追加を追記）
- Next: §9 の API、合成ジョブ、Range 配信、録画中 409
- プレイヤー: DemoClock ＋ AudioFileVoice ＋ SilentVoice、シーク、速度、章、実行結果の表示

**v1.1**: web 問題（ブラウザ側検証）、Web Speech フォールバック、アプリ内 API 生成、`highlight` の描画、VOICEVOX アダプタ、声の選択 UI、公式デモ昇格、複数ファイル
**v2**: クラウド TTS アダプタ、面接官 TTS（FR-U-20）への TTS 層の再利用、語単位の字幕追従（VOICEVOX のモーラ時刻）

---

## 13. UX レビュアーと揃える必要があること

1. **時間の単位は章 → ステップ**。シーク・ブックマーク・リンクは `{step_id, offset}`。総時間は合成前は推定で、合成後に ±20% 動く。
2. **音声が無い／生成中の状態が正式なモード**（字幕のみで最後まで見られる）。「音声を生成中 12/40」の表示が要る。
3. エディタは打鍵が見える逐次更新（`CodeAtT` の差し替え方式ではない）。疑似カーソルと選択の見せ方、`highlight` の色（既存は `--bg-hl-line`、`CodeAtT.tsx:43`）。
4. 字幕リストは `Transcript` 形で渡すので `TranscriptPane` の流用可否、編集密度レーン（`density.ts:33`）を出すかどうか。
5. 実行ステップの結果（保存済み）を出す出力欄が要る。
6. 速度 0.75–2×、一時停止、章ジャンプ、キー操作はレビュー画面と揃える（Space・←/→）。
7. ネタバレの入口（レビュー画面・問題ページ）と確認の有無。録画中は再生不可。
8. MCP の `save_demo_script` が返す URL のルート名（案 `/demos/<demo_id>`）。

---

## 14. 未確定（実測・確認が要るもの）

- macOS の日本語音声の一覧（Kyoko / Otoya / O-ren / Hattori、Enhanced・Premium の有無）と `say -v` で指定できる範囲、Siri 音声の扱い。
- `say` の m4a 直接出力オプションとビットレート指定、合成速度（12 分ぶんの所要時間）。
- 日本語音声が英字識別子・記号をどう読むか（reading 必須度の判断材料）。
- 既定の読み速度 6.5 字/秒の妥当性（較正で置き換える前提）。
- MCP クライアント（Claude Desktop / Claude Code）のツール入力サイズとタイムアウトの実際。
- Chrome の Web Speech の不具合（長い発話の打ち切り、pause/resume）の現状。
