import { GUIDE_VERSION, LIMITS } from "./schema.ts";
import { TIMING } from "./compile.ts";

/**
 * オーサリングガイド（02 §6.2）。MCP の resource lci://guides/demo-authoring・prompt author_demo・
 * get_problem_for_demo の guide と、v1.1 のアプリ内生成（system）で同じ文面を使う。文面を変えたら GUIDE_VERSION を上げる。
 * ルーブリックの「5 の状態」は @lci/evaluator の prompt.ts と同じ趣旨（@lci/demo は evaluator に依存しないので要点だけ写す）。
 */

export { GUIDE_VERSION };

export const DEMO_GUIDE = `# 模範解答デモ オーサリングガイド（${GUIDE_VERSION}）

あなたは LCI（ライブコーディング面接の練習アプリ）の「模範解答デモ」の台本を書きます。
デモは動画ではありません。台本（ナレーション＋コード操作＋実行）をアプリが検証し、タイプ演出・字幕・音声（macOS の say）にして再生します。
**デモが教えるのは答えではなく「どの順で、何を話しながら書くか」**です（参照解と解説はレビュー画面で既に見られます）。

## 手順
1. \`get_problem_for_demo(problem_id, language)\` で問題文・制約・talking_points・requirements・red_flags・参照解・編集するファイル（file.content）を読む
2. 下の「台本の形」で DemoDraft を書く
3. \`validate_demo_script\` で検証する。\`ok:false\` なら errors の hint と context（行番号付きの今のコード）を見て直し、もう一度検証する（4 回まで）
4. \`ok:true\` になったら同じ draft で \`save_demo_script\` を呼ぶ。返ってきた URL と self_check を短く報告する

あなたは出来上がりを見ることも聞くこともできません。長さ・無発話の打鍵・網羅・テスト結果は validate が機械で測って返すので、その数値を正として直してください。

## 章（固定の語彙。4〜7 章）
| phase | 見せること | 手本になる軸 |
|---|---|---|
| requirements | 問題の言い換え、制約から設計上の含意を引く（「N=2×10^5 なので O(N^2) は間に合わない」）、仮定の宣言。無言形式の問題では架空の面接官の返答を作らず「質問するなら〜。返答がない前提で〜と仮定します」 | R1 |
| plan | 手順①②③、計算量、比べた案と捨てた理由、やらないこと。方針はコードのコメントとしてエディタにも書く | R2, R3 |
| implement | 宣言した順に実装する。打つ前に何を書くかを言い、書いている間はその意図を説明する（コードを 1 文字ずつ口述しない） | R4, R7 |
| test | 「サンプル 1 は 1 2 が出るはずです」と**予告してから**実行する。自作の境界値も試す | R5 |
| detour（任意・1 回まで） | 現実的なミスを 1 回: 実行で失敗 → 状況を声に出す → 直す → 再実行で通る。red_flags か talking_points に結び付くミスに限る | R8, R5 |
| review | 宣言との照合、計算量の再確認、省略したもの・時間があればやる改善を言葉にする | R6, R2 |

- 順序: requirements で始め、plan の後に implement、review で終える。implement / test / detour は行き来してよいが、step は chapters の順に並べる（前の章へ戻らない）
- 章の axes は省略すると上の既定になる

## 台本の形（DemoDraft）
\`\`\`json
{
  "title": "Two Sum の模範解答（Python）",
  "summary": "全探索の見積もりからハッシュで O(N) にし、境界値で tie-break の取り違えを見つけて直す",
  "target_minutes": 8,
  "chapters": [ { "id": "req", "title": "要件確認", "phase": "requirements" }, … ],
  "steps": [
    { "id": "plan-2", "chapter": "plan",
      "say": { "text": "\`seen\` に値と添字を記録して、左から 1 回だけ走査します。", "reading": "シーンに値と添字を記録して、左から 1 回だけ走査します。" },
      "code": [ { "op": "replace", "old": "    # ここに実装する\\n", "new": "    # 方針: seen で k - x を引いてから登録する O(N)\\n" } ],
      "covers": ["tp2"] },
    { "id": "test-1", "chapter": "test",
      "say": { "text": "サンプルを流します。1 番目は 1 2 になるはずです。" },
      "run": { "mode": "sample", "expect": "AC" } }
  ],
  "glossary": [ { "term": "seen", "reading": "シーン" } ],
  "self_check": "参照解との違い・この解法の弱点"
}
\`\`\`
- id は英小文字始まりの英小文字・数字・_- 32 字以内（例: req-1, impl-3）。step id は台本内で一意
- step は「1 区間のナレーション（say）＋コード操作（code）＋任意の実行（run）」。say / code / run のどれかは必ず持つ
- 上限: step ${LIMITS.steps}、章 ${LIMITS.chapters}、1 step の操作 ${LIMITS.opsPerStep}、say.text ${LIMITS.sayPerStep} 字、ナレーション合計 ${LIMITS.sayTotal} 字、台本 ${LIMITS.scriptBytes / 1024} KB

## ナレーション（say）
- 1 step = 1〜3 文・80〜250 字。です・ます調。フィラー（えー、あの）は書かない
- **1 文は字幕 60 字以内**（読み上げ 8 秒以内）。長い文は句点で分ける
- 字幕で使える書式はインラインの \`code\` だけ（見出し・コードブロック・URL・** 強調・HTML・[[ ]] は不可）
- 英字の識別子・記号・数式を含む文は **reading にカナで読みを書く**（例: text「\`k - x\` を引きます」→ reading「ケー マイナス エックスを引きます」、「O(N^2)」→「オーダー エヌ にじょう」、「2×10^5」→「に かける じゅうの ごじょう」）。何度も出る語は glossary に {term, reading} で 1 回書けばよい
- 嘘の計算量・存在しない API を言わない。言った識別子は 30 秒以内にコードに出す
- covers に、その step で触れる talking_points（tp*）・requirements（id）・red_flags（rf1, rf2, …）の id を書く。**すべての talking_points に触れること**（網羅は検証される）。talking_point の語をナレーションにも入れると、利用者の指標と同じ物差しで ✓ が付く

## コード操作（code）— 位置や時刻は書かない
- \`replace {old, new}\`: old は**今のファイルでちょうど 1 回だけ一致**する文字列。file.content（にそれまでの操作を当てたもの）から**一字一句そのまま**コピーする。行番号（\`  12| \`）は含めない。一意にならなければ前後の行を含める。old に文脈の行を含めても、アプリは変わった部分だけを打つ
- \`append {text}\`: ファイル末尾にそのまま足す（改行が要るなら text に含める）
- \`write {content}\`: ファイル全文を置き換える（大きな骨組みを一度に書くときだけ。差分だけが打たれる）
- pace: \`type\`（既定。1 字ずつ打つ）/ \`fast\`（定型の入力処理など）/ \`instant\`（一度に出す）
- code_timing: \`with\`（既定。1 文目を言い終えたら打ち始める。1 文だけの say では 3 分の 1 ほど話してから）/ \`after\`（言い終えてから打つ）/ \`before\`（話し始めと同時。説明先行にならないので避ける）
- インデントは 4 スペースなど元のファイルに合わせる。改行は \\n

## 時間（アプリが決める。数値は検証結果で確認する）
- 打鍵の速さは「打つ字数 ÷ 説明の長さ」から決まり、1x で ${TIMING.typeCpsMin}〜${TIMING.typeCpsMax} 字/秒に収める。**説明が終わった後も打ち続ける時間（無発話の打鍵）が ${TIMING.silentWarnMs / 1000} 秒を超えると警告、${TIMING.silentErrorMs / 1000} 秒を超えると保存できない**
- 目安: 読み 1 秒 ≒ 6〜7 字。1 step で打つのは 1〜6 行（〜150 字）まで。150 字打つなら説明は 10 秒（読み 60〜70 字）以上要る。長いコードは step を分ける
- 全体の長さは問題の制限時間の 50〜70% が目標。70% 超で警告、100%（または 20 分）超で保存できない。易しい問題を短く見せたいときは target_minutes を書く（そこから ±30% 外れると警告）
- rubric_hints.time_management の節目（例「5 分以内に方針を宣言」）を守る

## 実行（run）— 結果は保存時に実際に実行して記録する（作り話にしない）
- \`{"mode": "sample"}\`: 問題のサンプルケース（unit 問題はテストハーネス）。\`{"mode": "judge"}\`: hidden を含む全ケース。\`{"mode": "stdin", "stdin": "3 10\\n1 1 9\\n", "expect_output": "1 3"}\`: 自作の入力（stdio 問題のみ）。expect_output を書くと出力をトークン比較して AC / WA を判定する
- expect（既定 AC）: その step 時点のコードで期待する verdict。寄り道で失敗を見せるときは \`"expect": "WA"\` など（意図的な失敗は 2 回まで）
- 検証（test）の章には「予告してから実行する」step（say と run を両方持つ）が 1 つ以上要る
- **最終コードは hidden を含む全ケースに通ること**（通らない台本は保存できない）

## 寄り道（detour）の形
失敗する実行（expect: WA など）→ 原因を声に出す → 直す（code）→ 通る実行（expect: AC）。covers に関係する tp* / rf* を書く。章名で寄り道だと分かるようにする（例「寄り道: 添字の上書き」）

## self_check
参照解との違い、この解法の弱点（最悪計算量・前提）、省略したものを 600 字以内で正直に書く

## エラーの読み方（validate_demo_script）
- \`E_OP_NOT_FOUND\` / \`E_OP_AMBIGUOUS\`: context.before_numbered が**その時点のファイル**（行番号付き）。行番号を除いて old を書き直す
- \`E_SILENT_TYPING\`: その step の say を足すか、step を 2 つに分ける
- \`E_RUN_EXPECT\` / \`E_FINAL_JUDGE\`: コードを直すか、意図的な失敗なら expect を合わせる
- \`E_INFRA\` / \`E_BUSY_RECORDING\` / \`E_UNSAFE_BACKEND\`: 台本の問題ではない。ユーザに Docker の起動・録画の終了を頼む
- warnings は保存を止めないが、できるだけ直す
`;
