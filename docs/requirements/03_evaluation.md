# 03 評価サブシステム 要件定義（Think-aloud ライブコーディング評価）

作成: 要件アナリスト（面接官経験者視点） / 対象: brief.md の「終了後に Claude が面接官視点の評価を返す」部分
前提資料: brief.md, pixiv_problem.md（20分・一方的に話し続ける形式・キャッシュ戦略説明必須）

---

## 1. 目的

- ユーザ（Nico）が 1 セッション（約 20 分）を終えた直後に、**実務の面接官が見ているのと同じ観点**で、タイムライン（発話＋コード編集）に紐づく具体的フィードバックを得る。
- 「上手でしたね」型の褒め言葉ではなく、**次回の練習で何を変えるか**が 3 つ以内に絞られて出ること。
- 評価は再現性があること（同じセッションを 2 回評価して総合スコアが ±0.5 以内に収まる）。
- Claude Desktop / Claude Code からは MCP 経由で、アプリ単体では Anthropic API 直叩きで、**同じルーブリック・同じ出力スキーマ**で動くこと。

### 1.1 評価対象の素材（他サブシステムからの入力）
| 素材 | 形式 | 由来 |
|---|---|---|
| 文字起こし | セグメント列 `{t0,t1,text,confidence}` | 01_録音・文字起こし |
| 編集ログ | 操作列 `{t,file,range,kind(insert/delete/replace),textDelta}` ＋ 定期スナップショット | 02_エディタ・ログ |
| 実行ログ | `{t,cmd,stdout,stderr,exit}` | 02 |
| 動画（画面＋Webカメラ） | mp4 / webm | 01 |
| 問題メタ | 問題文・想定解答方針・模範実装・配点ヒント | 問題DB |

---

## 2. 評価ルーブリック

### 2.1 設計方針（面接官が実際に見ているもの）
Pixiv の試験形式（一方的に話す・返答なし・20分）や M3/CyberAgent 系の面接で、面接官が評価表に書くのはおおむね次の 3 層である（要確認: 各社の公式評価表は非公開。ここは複数の面接官経験と公開記事からの再構成）。

1. **思考の可視性**: 「何をこれからやるか」が手より先に出ているか。黙って書いて後から説明する人は低評価。
2. **判断の質**: 要件の読み違いがないか、トレードオフを自分の言葉で言えるか、制約（今回なら「貧弱なサーバ」）を設計に反映しているか。
3. **実装の信頼性**: 動くか、エッジケースを自分で見つけるか、テスト/動作確認を能動的にするか。

「流暢に喋る」は評価項目ではない。**沈黙・言い直し・フィラーは、思考が止まっている兆候として間接的に減点される**だけで、それ自体を直接の配点にしてはいけない（後述 7 章: LLM が過剰に減点しがちな項目）。

### 2.2 評価軸と尺度（各 1–5、総合は重み付き平均）

| # | 軸 | 重み | 定義（5 の状態） | 1 の状態 | 主な自動計測エビデンス（transcript + edit log） |
|---|---|---|---|---|---|
| R1 | 要件確認 | 15% | 開始 2 分以内に入出力・制約・曖昧点を言語化し、質問すべき点を質問（or 仮定を明示）する | 問題を読み上げただけで実装に入る | `t_first_edit` までの発話に要件語（API形式/空クエリ/キャッシュ/貧弱）が何個含まれるか／仮定の明示回数 |
| R2 | 方針宣言 | 15% | 実装前に全体構成と手順（①②③）を宣言し、その順に実装する | 方針なし、書きながら考える | 「方針宣言 → 対応コードの初回編集」の時間差；宣言した項目の実装率 |
| R3 | トレードオフ説明 | 15% | 採用案と不採用案を比較し理由を言う（Map vs LRU、debounce の要否、AbortController） | 選択理由がない／「なんとなく」 | 比較表現（「〜に対して」「代わりに」「今回は〜なので」）の数と、それがコードのどの範囲に対応するか |
| R4 | 実装正確性 | 20% | 要件を満たし実行で動く。エッジ（空クエリ・連打・古いレスポンス）を扱う | 動かない／要件漏れ | 実行ログの exit/エラー、模範解答との要件チェックリスト照合、構文エラー回数 |
| R5 | テスト・検証意識 | 10% | 実装の区切りごとに自分で動作確認・境界値を試す | 最後まで一度も実行しない | 実行回数と間隔、実行前の「〜を確認します」発話の有無 |
| R6 | 時間配分 | 10% | 20 分内に核が完成し、残りで改善。前半に方針、終盤に見直し | 設計で 10 分超、または最後 5 分で大改造 | 各フェーズ（読解/設計/実装/検証）の推定時間比、終了 3 分前以降の編集量 |
| R7 | 説明とコードの同期 | 10% | 説明が実装に 5–30 秒先行し、説明と編集箇所が一致 | 説明が実装から乖離、または黙って書く | 「説明先行秒数」の分布、無発話編集区間の合計、発話内容と編集範囲のシンボル一致率 |
| R8 | 対話態度（質問の仕方・復帰力） | 5% | 詰まった時に状況を声に出し、仮定を置いて進む。質問は具体的 | 黙り込む／言い訳 | 沈黙 >15s の回数、沈黙後の最初の発話種別（状況説明 / 無言再開）、方針変更回数とその宣言有無 |

総合 = Σ(重み × スコア)。**総合点だけを見せない**（後述の UI 要件）。

### 2.3 エビデンス指標の定義（アプリ側で決定的に計算し、Claude には入力として渡す）
LLM に「沈黙を数えろ」と頼むと数え間違える。以下はアプリが計算して JSON で渡し、Claude は**解釈**だけを行う。

| 指標 | 定義 | 備考 |
|---|---|---|
| `lead_time_s[]` | 発話セグメント中の識別子/概念語（`cache`, `Map`, `AbortController`, 関数名）が初めて出た時刻と、その語がコードに初めて現れた時刻の差 | 正なら「説明先行」。中央値と、負値（コード先行）の割合を出す |
| `silence_gt15s` | 15 秒以上発話がない区間の数・合計秒・各区間での編集有無 | 「黙って書いている」と「手も止まっている」を区別 |
| `silent_edit_ratio` | 編集が発生した 10 秒ビンのうち発話ゼロのビンの割合 | R7 |
| `direction_changes` | 同一関数/ブロックを 30 行以上削除して書き直した回数、またはファイル構成変更 | R2/R6。宣言発話（「方針を変えます」）が ±20s 内にあったかを付与 |
| `restatements` | 文字起こし上の言い直し（「あ、違う」「じゃなくて」「えっと、〜ではなく」）の数 | 日本語の言い直しマーカー辞書で検出。**減点に直結させない** |
| `filler_rate` | フィラー（えー/あの/その/まあ/なんか/えっと）の分あたり頻度 | 参考値のみ。レポートでは「気になるなら」程度に 1 行 |
| `phase_estimate` | 読解/設計/実装/検証の 4 フェーズ推定（編集量・実行・発話キーワードから HMM 的に） | R6 |
| `run_events` | 実行回数、各実行の成否、実行間の編集量 | R5 |
| `req_checklist` | 問題メタの要件チェック項目ごとに、コードに該当実装があるか（静的検索＋Claude 判定） | R4 |
| `question_events` | 「〜でいいですか」「〜と仮定します」型の発話 | R1/R8 |

### 2.4 日本語フィラー・言い直しの扱い
- Whisper 系は「えー」「あの」を**落とす傾向**がある（要確認: モデル・設定依存）。従って transcript ベースのフィラー計測は過小評価になる。**フィラーを採点対象にしない**のはこの理由もある。
- 「〜ですね」「〜という感じで」など日本語特有の語尾は冗長さの指標にしない。
- 言い直しは「思考の修正」であって「準備不足」ではない。**言い直しの直後に理由を述べているか**（「配列だと O(n) なので Map にします」）を見る。理由付きの言い直しはむしろ R3 の加点証拠。
- Claude への system prompt に「フィラー・言い直し・話速は採点しない。沈黙は 15 秒超かつ編集も停止している場合のみ R8 の証拠にする」と明記する。

---

## 3. 機能要件（FR-E-xx）

### MUST
- **FR-E-01** セッション終了後、ワンクリック（または MCP の `evaluate_session` プロンプト）で 2.2 の 8 軸スコア＋フィードバック JSON（5 章）を生成する。
- **FR-E-02** 2.3 の指標はアプリ側（TypeScript）で決定的に計算し、`metrics` としてモデル入力に含める。LLM に再計算させない。
- **FR-E-03** すべてのフィードバック項目は `t`（秒）を必須で持ち、可能なら `code_ref`（file, 行範囲, スナップショット時刻）を持つ。t を持たない「総評」は `summary` フィールドに限定する。
- **FR-E-04** 各フィードバック項目は `evidence`（transcript 引用 or 編集ログ参照）を最低 1 つ持つ。証拠のない指摘は UI 上「推測」ラベルで区別する。
- **FR-E-05** 「次回の練習提案」は最大 3 件。各件が「どの軸」「どの時刻の出来事が根拠か」「具体的に何を変えるか」を含む。
- **FR-E-06** 模範解答比較: 問題メタの要件チェックリスト（例: 空クエリ送信抑止 / キャッシュ / 中断 / TTL or LRU / レイアウト）に対して 実装済み・未実装・言及のみ の 3 値を出す。
- **FR-E-07** 評価は MCP 経由（Claude Desktop / Claude Code）とアプリ内（Anthropic API 直接）の両方で実行でき、同一の system prompt・同一のルーブリック版・同一の出力スキーマを使う。
- **FR-E-08** 評価結果は `rubric_version`, `model`, `prompt_hash`, `input_digest` を保存し、再評価時に差分表示できる。
- **FR-E-09** API キー・評価結果はローカル保存。評価入力に Web カメラ映像フレームを含めるかはユーザの明示的 ON（デフォルト OFF）。
- **FR-E-10** structured outputs（`output_config.format`）で 5 章のスキーマを強制し、パース失敗時は 1 回だけ自動リトライ。

### SHOULD
- **FR-E-11** 再評価（同じ入力・同じ設定）を実行し、軸ごとのスコア差分と「変わった指摘/変わらない指摘」を表示する（安定性の自己診断）。
- **FR-E-12** 画面動画からの**キーフレーム抽出**（編集バースト境界・実行時刻・沈黙開始時刻）を行い、画像として評価入力に追加できる（6 章）。
- **FR-E-13** ルーブリックの few-shot アンカー（軸ごとに 1/3/5 の実例）をローカル YAML で管理し、ユーザが編集できる。
- **FR-E-14** 過去セッションとの推移（軸別スコアの折れ線）を表示。ただし問題難易度が違うので「同一問題カテゴリ内」でのみ比較する。
- **FR-E-15** 評価実行前に入力トークン数を `count_tokens` で見積もり、概算コストを表示してから実行する。

### COULD
- **FR-E-16** 面接官ペルソナ切替（Web フロント重視 / セキュリティ重視 / アルゴリズム重視）。ルーブリックの重みだけを変える。
- **FR-E-17** 「この箇所を面接官ならどう突っ込むか」の追問生成（タイムラインの任意点を選んで質問）。
- **FR-E-18** Web カメラ映像からの非言語評価（視線・姿勢）。**v1 では実装しない**（精度・倫理・誤評価リスクが高い）。
- **FR-E-19** Batch API での夜間一括再評価（50% コスト）。

---

## 4. MCP サーバ設計

### 4.1 配置と接続
- ローカル stdio サーバ（Node/TypeScript, `@modelcontextprotocol/sdk`）。アプリ本体と同じ SQLite / ファイルストアを読む。
- Claude Desktop は `claude_desktop_config.json`、Claude Code は `claude mcp add` で登録（要確認: 最新の設定ファイル名・コマンド）。
- **Claude は動画ファイルをそのまま読めない。** MCP の content 型は text / image（base64 + mimeType） / audio / embedded resource であり、video は存在しない。従ってサーバ側で画像に落として返す（6 章）。
- 1 回の tool result に大量画像を返すと Claude Desktop 側で切られる可能性がある（要確認: クライアント側の上限）。**1 コール 1–4 枚**、時刻範囲指定で分割取得を前提にする。

### 4.2 Tools

| tool | 入力 | 出力 | 用途 |
|---|---|---|---|
| `list_sessions` | `{limit?, problem_id?, since?}` | `[{session_id, problem_id, started_at, duration_s, language, has_video, eval_count}]` | セッション選択 |
| `get_session_overview` | `{session_id}` | 問題文・言語・時間・最終コード（全文）・実行結果サマリ・`metrics`（2.3 全指標） | 最初に 1 回呼ぶ。これだけで概評は書ける |
| `get_session_timeline` | `{session_id, t0?, t1?, granularity_s?=10}` | 10 秒ビンごとの `{t, speech_chars, edit_lines, files_touched, run?, silence?}` | 全体の流れを把握。トークン節約のため集約済み |
| `get_transcript` | `{session_id, t0?, t1?}` | `[{t0,t1,text,confidence,markers:["restatement"|"question"|"plan"]}]` | 範囲指定で引用取得 |
| `get_edit_log` | `{session_id, t0, t1}` | `[{t,file,range,kind,summary}]`（diff 本文は 200 文字で切り、必要なら `get_code_snapshot_at` で） | 編集の中身 |
| `get_code_snapshot_at` | `{session_id, t, file?}` | その時刻のファイル全文（＋直前スナップショットからの unified diff） | 「t=540 のコード」を見る |
| `get_video_frames` | `{session_id, t0, t1, strategy:"keyframes"|"uniform", max_frames?=4, source:"screen"|"camera"}` | `image` content ×N（各に `t` を text で前置） | 6 章参照。camera はデフォルト拒否、ユーザ設定で許可 |
| `get_problem_reference` | `{problem_id}` | 問題文・要件チェックリスト・想定解答方針・模範実装 | 模範解答比較 |
| `save_evaluation` | `{session_id, evaluation: <5章スキーマ>}` | `{evaluation_id}` | サーバ側で JSON Schema 検証して保存。UI に即反映 |
| `get_rubric` | `{version?}` | ルーブリック本文＋few-shot アンカー | プロンプトとの二重管理を避けるため tool でも取れるように |

スキーマ例（`get_video_frames` 入力、JSON Schema）:
```json
{ "type":"object","required":["session_id","t0","t1"],
  "properties":{
    "session_id":{"type":"string"},
    "t0":{"type":"number","minimum":0},
    "t1":{"type":"number"},
    "strategy":{"enum":["keyframes","uniform"],"default":"keyframes"},
    "max_frames":{"type":"integer","minimum":1,"maximum":4,"default":4},
    "source":{"enum":["screen","camera"],"default":"screen"}
  },"additionalProperties":false }
```

### 4.3 Resources
- `session://{id}/overview.json`（= get_session_overview と同内容。Desktop の「添付」UI で使える）
- `session://{id}/transcript.txt`（人間可読、タイムスタンプ付き）
- `session://{id}/final/{path}`（最終コード）
- `rubric://current`（ルーブリック markdown）
Resource は「ユーザが手で添付する」導線、Tool は「Claude が自律的に取る」導線。両方出すが、実装は同じリポジトリ関数を呼ぶ。

### 4.4 Prompts
- `evaluate_session(session_id, persona?="web_frontend", include_video?=false)`
  - 展開内容: ルーブリック本文（`rubric://current`）＋ 取得手順の指示（overview → timeline → 疑わしい区間だけ transcript/edit_log/frames を深掘り → `save_evaluation` で保存）＋ 出力スキーマ ＋ 7 章の反フラッタリング指示。
- `compare_with_previous(session_id, previous_session_id)`
- `interviewer_followup(session_id, t)`（COULD）

### 4.5 MCP 経由 vs アプリ内 API 直接 — 推奨
| 観点 | MCP（Claude Desktop/Code） | アプリ内（Anthropic API 直接） |
|---|---|---|
| 追加費用 | サブスク内（要確認: Desktop の MCP 利用上限） | 従量（8 章: 1 回 ≈ $0.3–0.8） |
| 再現性 | 低い（Claude が自律的にどの tool を何回呼ぶか毎回違う、モデル/設定もクライアント依存） | 高い（入力を固定し structured outputs で型を強制できる） |
| 対話的深掘り | 強い（「この 3 分だけ見直して」ができる） | 要 UI 実装 |
| UX | 別アプリに行く必要がある | ワンクリック、タイムラインに即ピン留め |
| 画像の扱い | クライアント側上限に左右される | 自前で制御（最大 100 枚/リクエスト、要確認: 現行上限） |

**推奨: アプリ内 API 直接を「正式評価」の主経路（v1 必須）、MCP を「対話的レビュー」の副経路として両方提供する。** 理由: 評価の一貫性（FR-E-08/11）と、ユーザが「終わった瞬間に結果を見る」体験は API 直接でしか保証できない。MCP は同じリポジトリ関数を叩くだけなので追加コストが小さく、Claude Code 利用者（開発者本人）には有用。
実装メモ（claude-api skill 準拠）: モデルは `claude-opus-5-5`（既定、thinking は省略＝adaptive、`output_config.effort:"high"` を明示。既定は medium）、`fallbacks:"default"` + beta `server-side-fallback-2026-07-01`、structured outputs、ストリーミングで `max_tokens` 余裕を持たせる。ルーブリック＋few-shot は system の先頭に置き `cache_control` で prompt caching。安価経路として `claude-sonnet-5-5` を設定で選べるようにする（既定にはしない）。

---

## 5. 評価結果スキーマ（JSON）

```json
{
  "schema_version": "1.0",
  "rubric_version": "2026.10-a",
  "session_id": "s_20261024_1",
  "model": "claude-opus-5-5",
  "prompt_hash": "sha256:…",
  "input_digest": { "transcript_segments": 212, "edit_events": 1480, "frames": 12, "metrics_version": "1" },
  "scores": {
    "R1_requirements": { "score": 4, "confidence": 0.8, "rationale": "開始38秒で『空クエリは送らない』『貧弱なサーバ＝リクエスト数を減らす』と言語化。APIのエラー時挙動は未確認", "evidence": ["tr:00:38-00:55"] },
    "R2_plan": { "score": 3, "confidence": 0.7, "rationale": "①②③を宣言したが③中断は実装されず", "evidence": ["tr:01:40-02:10", "edit:12:05 fetch 周辺"] },
    "R3_tradeoffs": { "score": 3, "confidence": 0.6, "rationale": "Map を選んだ理由は言ったが LRU/TTL の比較がない", "evidence": ["tr:06:12-06:30"] },
    "R4_correctness": { "score": 4, "confidence": 0.9, "rationale": "全要件のうち中断のみ未実装。実行は成功", "evidence": ["run:14:20 exit0", "checklist"] },
    "R5_testing": { "score": 2, "confidence": 0.9, "rationale": "実行は14:20の1回のみ。空クエリ・連打は未検証", "evidence": ["metrics.run_events"] },
    "R6_time": { "score": 4, "confidence": 0.8, "rationale": "設計2.5分、実装12分、終盤4分は整形。妥当", "evidence": ["metrics.phase_estimate"] },
    "R7_sync": { "score": 3, "confidence": 0.7, "rationale": "説明先行の中央値 8s だが 09:10-11:40 は無発話で実装", "evidence": ["metrics.lead_time_s", "metrics.silence_gt15s[2]"] },
    "R8_attitude": { "score": 4, "confidence": 0.5, "rationale": "沈黙22秒後に『fetch のシグネチャを思い出しています』と状況説明。良い", "evidence": ["tr:09:32"] },
    "overall": 3.5
  },
  "requirement_checklist": [
    { "id": "no_empty_query", "label": "空クエリは送信しない", "status": "implemented", "code_ref": { "file": "index.html", "lines": [41, 44], "at": 480 }, "mentioned_at": 38 },
    { "id": "cache_same_query", "label": "同一クエリはキャッシュ", "status": "implemented", "code_ref": { "file": "index.html", "lines": [30, 39], "at": 600 }, "mentioned_at": 100 },
    { "id": "abort_stale", "label": "古いリクエストの中断", "status": "mentioned_only", "mentioned_at": 110 },
    { "id": "ttl_or_lru", "label": "TTL/LRU による鮮度・上限", "status": "missing" },
    { "id": "layout", "label": "input+button 横並び、下に div", "status": "implemented", "code_ref": { "file": "index.html", "lines": [10, 18], "at": 200 } }
  ],
  "feedback": [
    { "id": "f1", "t": 110, "t_end": 125, "axis": "R2_plan", "severity": "major", "kind": "gap",
      "title": "宣言した『古いリクエストを中断』が最後まで実装されなかった",
      "detail": "01:50 に『AbortController で古いのは捨てます』と宣言。しかし 20 分間 fetch 周辺にその実装はない。面接官は宣言と実装の差分を必ず見る。宣言した以上、『時間がないので後回しにします』と撤回を言語化すべき",
      "evidence": [ { "type": "transcript", "t0": 110, "t1": 125, "quote": "古いリクエストは AbortController で捨てる方針で" }, { "type": "edit_absence", "symbol": "AbortController" } ],
      "code_ref": { "file": "index.html", "lines": [45, 60], "at": 1200 },
      "interviewer_question": "連打したとき、古いレスポンスが後から来たらどうなりますか？" },
    { "id": "f2", "t": 550, "t_end": 700, "axis": "R7_sync", "severity": "minor", "kind": "silence",
      "title": "09:10–11:40 無発話でキャッシュ実装",
      "detail": "手は動いているので思考停止ではないが、一方的に話し続ける形式ではこの 150 秒が最大の減点ポイント。『Map にクエリをキーで入れて、値は data と ts』と書いている内容をそのまま読み上げるだけで良い",
      "evidence": [ { "type": "metric", "name": "silence_gt15s", "index": 2 } ],
      "code_ref": { "file": "index.html", "lines": [30, 39], "at": 700 } },
    { "id": "f3", "t": 38, "axis": "R1_requirements", "severity": "positive", "kind": "strength",
      "title": "『貧弱なサーバ』を設計制約として最初に言い換えた",
      "detail": "制約→設計方針への変換を 1 分以内にやっている。これは維持すること",
      "evidence": [ { "type": "transcript", "t0": 38, "t1": 55, "quote": "サーバが貧弱なので、リクエスト数を減らすのが一番の目標です" } ] }
  ],
  "model_answer_comparison": {
    "covered": ["no_empty_query", "cache_same_query", "layout"],
    "missing": ["abort_stale", "ttl_or_lru"],
    "beyond_model": [],
    "notes": "debounce について『ボタン起点なので不要』と線引きできていれば R1 で 5 だった。言及なし"
  },
  "next_practice": [
    { "axis": "R5_testing", "action": "実装の区切り（空クエリ処理を書いた直後など）で必ず 1 回実行し、『空で押すと何も起きないはず』と予告してから押す", "based_on": ["f1", "metrics.run_events"] },
    { "axis": "R7_sync", "action": "書いているコードをそのまま音読する練習を 2 セッション。目標: silent_edit_ratio < 0.2", "based_on": ["f2"] },
    { "axis": "R2_plan", "action": "宣言した項目を終盤 3 分でチェックリスト読み上げ。やらないものは『省略します』と明言", "based_on": ["f1"] }
  ],
  "summary": "要件理解と時間配分は合格水準。宣言と実装の差分（中断処理）、検証回数の少なさが主な課題。",
  "uncertainties": ["Webカメラ映像は未使用", "文字起こし confidence < 0.6 の区間 (03:10-03:25) は解釈していない"]
}
```

### 5.1 UI での描画（タイムラインへのピン留め）
- 既存のセッション再生画面（動画 + transcript + エディタ差分）の時間軸上に `feedback[].t` をピンで表示。severity で色（major / minor / positive）。
- ピンをクリック → その時刻に再生ヘッドが移動、エディタは `code_ref.at` のスナップショットで `lines` をハイライト、transcript は `evidence.quote` をハイライト。
- 右ペインに 8 軸レーダー ＋ 各軸の `rationale`（クリックで `evidence` へジャンプ）。総合点は小さく表示。
- `requirement_checklist` は問題文の横にチェック表示。`mentioned_only` は黄色（「言ったけど書いていない」は面接官が最も気にする）。
- `next_practice` は 3 枚のカードとして最上部。次セッション開始画面にも再掲する。
- `confidence < 0.6` の項目と `evidence` が空の項目は「推測」バッジ。

---

## 6. 動画の扱い

**正直な前提: Claude は動画を見られない。** API / MCP ともに入力は text・画像（静止画）・PDF・音声は MCP 側では audio 型のみ（要確認: Claude Desktop が audio content をモデルに渡すか）。動画は必ず静止画に変換する。

### 6.1 画面録画
評価に必要な情報の大半は**編集ログと実行ログに既にある**。画面動画が追加で与えるのは次の 3 点のみ:
1. エディタ外の操作（ブラウザでの動作確認、DevTools、問題文の見直し）
2. 実行結果の見た目（レイアウト要件: input+button 横並び）
3. ユーザが「どこを見ていたか」（スクロール位置）

従って方針は **「編集ログ主・動画従」**。

| 方式 | 内容 | 枚数/20分 | トークン概算 | 採否 |
|---|---|---|---|---|
| A. イベント駆動キーフレーム | 実行直後・編集バースト境界・沈黙開始・方針変更・終了時の 5 種類の時刻で 1 枚ずつ | 8–16 枚 | 1 枚 1568px 長辺で ≈1,100–1,600 tok → 計 1.5–2.5 万 | **v1 採用** |
| B. 1 fps コンタクトシート | 1 秒 1 枚を 6×5 グリッドで 1 枚画像化（30 秒/枚） | 40 枚 | 各セルが小さすぎてコードは読めない。「画面遷移の有無」しか分からない | v1 不採用。R6 の裏取り用に COULD |
| C. 全フレーム | — | 1,200 枚 | 上限・費用とも不可 | 不採用 |

- キーフレームは `get_video_frames(strategy:"keyframes")` で返す。各画像の直前に `t=540s（実行直後 / exit 0）` の text を付けて、Claude が時刻と結びつけられるようにする。
- 画像は長辺 1568px 以下に縮小（これ以上は API 側でリサイズされトークンだけ増える。要確認: 現行の上限）。
- 画面動画からコードを読み取らせない。コードは必ずスナップショットのテキストで渡す（OCR 誤りを防ぐ）。

### 6.2 Web カメラ
- v1 は評価入力に**含めない**（既定 OFF）。理由: (1) 非言語評価の妥当性が低く、LLM は「笑顔がない」「視線が泳ぐ」など根拠薄弱で主観的な指摘を生成しやすい、(2) 一方的に話す Pixiv 形式では面接官も画面共有を主に見ている、(3) 録画自体は振り返り用に有用なので保存は続ける。
- ユーザが明示 ON にした場合も、「カメラ ON/OFF、画面から長時間離れた区間」程度のメタ情報に留める。

---

## 7. リスクと反論（LLM 評価が間違えること）

| リスク | 具体 | 対策 |
|---|---|---|
| **お世辞バイアス** | 「全体的によくできています」から始まり、major が出ない | system prompt で「positive は最大 2 件、major/minor を先に列挙、総合 4.5 以上は要件チェック全 implemented のときのみ許可」と制約。few-shot に「3 点の例」を多めに置き、5 点アンカーは稀なものとして記述 |
| **流暢さ＝能力の誤認** | フィラー・言い直しが多いと内容が良くても減点 | 2.4 のルール。フィラー・話速は metrics に含めるが採点禁止を明記。評価後に自己チェック項目「フィラーを理由にした減点はないか」を出力させる |
| **長い発話を高評価** | verbosity bias。喋り続けていれば R7 が上がる | R7 は「説明と編集箇所の一致」で測る。`lead_time_s` と `symbol 一致率` を渡し、発話量ではなく同期で判断させる |
| **数え間違い** | 沈黙回数・実行回数を LLM が誤る | FR-E-02。LLM は数えない。metrics を正とする |
| **幻覚引用** | 言っていない発話を quote する | `evidence.quote` はアプリ側で transcript に存在するか照合し、不一致なら項目を「推測」に降格 |
| **模範解答への過剰適合** | 別解（React + SWR 等）を「未実装」と誤判定 | checklist は「要件」で書き、「実装手段」で書かない（「AbortController」ではなく「古いレスポンスの無効化」）。`beyond_model` フィールドで別解を拾う |
| **文字起こし誤り由来の誤評価** | 専門用語の誤変換（「マップ」→「マップ」はよいが「アボートコントローラー」が崩れる） | confidence < 0.6 の区間を `uncertainties` に出させ、採点根拠に使わない。用語辞書で文字起こし側を補正（01 側要件） |
| **非決定性** | 同一入力で総合が 3.0 ↔ 4.0 揺れる | 8.2 参照。効果が小さいなら「スコアは 0.5 刻みの帯で表示」に逃げる |
| **MCP 経由での手順逸脱** | Claude が transcript だけ読んで frames や edit_log を見ずに評価 | prompt に必須手順を明記。`save_evaluation` でサーバが `input_digest` を検証し、edit_log 未参照なら警告を結果に付与 |
| **過度に厳しい（逆バイアス）** | 反フラッタリング指示が強すぎて萎縮させる | severity 配分の目安（major ≤3, minor ≤5, positive 1–2）と「positive は『維持すべき具体行動』として書く」を指示 |
| **評価が練習を歪める** | 指標最適化（沈黙を埋めるために無意味に喋る） | next_practice は行動（「書いていることを音読」）で書き、数値目標は補助。metrics の生値は上級者向けトグルに隠す |

反論への回答:
- 「人間の面接官の評価表がない以上ルーブリックは妄想では？」→ その通りで、本ルーブリックは仮説。だからこそ FR-E-13 でユーザ編集可能にし、実際の面接結果（通過/不通過）を後からセッションにラベル付けできるようにする（COULD: 相関確認）。
- 「API 直叩きだと Claude Desktop のサブスクで済まない」→ 1 回 $0.3–0.8（8 章）。週 5 セッションで月 $10 前後。MCP 経路も残すので選択可能。

---

## 8. 一貫性・コスト

### 8.1 決定性の確保
- 入力の正規化: metrics は小数 1 桁、transcript はセグメント ID 付き、edit_log は 10 秒ビン集約＋全文スナップショットは「フェーズ境界」と「最終」のみ。入力バイト列が同じなら prompt cache も効く。
- few-shot アンカー: 軸ごとに 1/3/5 点の短い実例（日本語、Pixiv 問題相当）。「3 点」を標準として記述し、5 点は「面接官が社内で話題にするレベル」と定義。
- 出力順序の固定: scores → checklist → feedback（t 昇順）→ next_practice → summary。structured outputs で型固定。
- 自己整合チェック: 出力の最後に `self_check: {flattery_check, filler_penalty_check, evidence_coverage}` を出させ、アプリ側で evidence 照合に失敗した項目を降格。
- 再評価（FR-E-11）: 同一入力で 2 回実行、軸差 ≥1 の項目を「不安定」として表示。v1 では手動ボタン。
- 注: `temperature` 等のサンプリングパラメータは現行 API で指定不可（claude-api skill 記載）。決定性は入力固定・effort 固定・スキーマ固定で担保する。

### 8.2 トークン・コスト・レイテンシ見積（20 分セッション、要確認: 実測で更新）
| 入力要素 | 概算トークン |
|---|---|
| system（ルーブリック + few-shot + 出力指示） | 6–8k（キャッシュ対象） |
| 問題メタ + 模範実装 | 2–3k |
| transcript（日本語 20 分 ≈ 5–7 千文字） | 6–10k |
| metrics + timeline（10 秒ビン × 120） | 3–5k |
| edit_log 集約 + diff 要約 | 5–15k |
| スナップショット（フェーズ境界 4 枚 + 最終、各 100–200 行） | 5–10k |
| キーフレーム画像 12 枚 | 15–20k |
| **合計** | **約 45–70k（画像なしなら 30–50k）** |
| 出力（JSON） | 4–8k |

| モデル | 単価（入/出 $/MTok） | 1 回あたり概算 | 備考 |
|---|---|---|---|
| claude-opus-5-5（既定） | 4 / 20 | 入 60k×$4 = $0.24 ＋ 出 6k×$20 = $0.12 ＋ thinking 分 → **約 $0.4–0.8** | system キャッシュヒットで −$0.02 程度 |
| claude-sonnet-5-5 | 2 / 10 | **約 $0.2–0.4** | 安価設定として提供 |
| Batch（夜間再評価） | 50% | 半額 | FR-E-19 |

- レイテンシ: adaptive thinking + effort high で **60–180 秒**（要確認）。ストリーミングし、`scores` → `feedback` の順に UI へ逐次描画する。MCP 経由は Claude が tool を 5–15 回呼ぶため 2–5 分。
- 月額目安: 週 5 セッション × 4 週 × $0.6 ≈ $12/月（Opus）。

---

## 9. v1 スコープ提案

**v1（MUST のみ、4–6 週間相当）**
- アプリ内 API 直接評価（FR-E-01〜10）。モデル claude-opus-5-5、structured outputs、system キャッシュ。
- metrics 計算（2.3 の `lead_time_s`, `silence_gt15s`, `silent_edit_ratio`, `direction_changes`, `run_events`, `phase_estimate`, `req_checklist`）。`restatements`/`filler_rate` は計算するが表示は折りたたみ。
- 画面キーフレーム（6.1 方式 A）を評価入力に含める（OFF 可）。Web カメラは含めない。
- MCP サーバ: `list_sessions`, `get_session_overview`, `get_transcript`, `get_edit_log`, `get_code_snapshot_at`, `get_problem_reference`, `save_evaluation` ＋ prompt `evaluate_session`。`get_video_frames` は v1.1。
- UI: タイムラインピン、8 軸レーダー、要件チェック、next_practice カード。
- Pixiv 問題 1 問で few-shot アンカーを作成し、本人のセッション 5 本で再評価安定性を確認（軸差 ≥1 が 20% 以下を合格ラインとする）。

**v1.1**: `get_video_frames`、再評価差分 UI（FR-E-11）、コスト事前見積（FR-E-15）、推移グラフ（FR-E-14）。
**v2 以降**: ペルソナ、追問生成、Batch 再評価、面接結果ラベルとの相関確認。Web カメラ非言語評価は原則やらない。

**やらないことの明示**: 総合点のみの表示、フィラー採点、動画そのものの LLM 入力、Web 上の他人のセッションとの比較。

---
参考（検索で確認した一般論、各社の公式基準ではない）: 面接官はライブコーディングで「思考の言語化・問題分解・コミュニケーション・コード品質」を見るとする記事が多数（geekly、CoderPad 系解説、intervue 等）。LLM-as-a-judge の既知バイアス（verbosity, position, self-preference, flattery）とルーブリック・few-shot・証拠要求による緩和は複数の実務記事で共通して指摘されている。
