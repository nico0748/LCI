import { z } from "zod";

/**
 * 評価ルーブリックと評価結果（要件書 03 §2, §5）。
 * 指標 (Metrics) はアプリ側で決定的に計算し、Claude は解釈のみを行う。
 */

export const RUBRIC_VERSION = "2026.10-a";

export const Axis = z.enum([
  "R1_requirements",
  "R2_plan",
  "R3_tradeoffs",
  "R4_correctness",
  "R5_testing",
  "R6_time",
  "R7_sync",
  "R8_attitude",
]);
export type Axis = z.infer<typeof Axis>;

export const AXES: { id: Axis; label: string; weight: number; description: string }[] = [
  { id: "R1_requirements", label: "要件確認", weight: 0.15, description: "問題文の要件・制約を自分の言葉で言い換え、曖昧点を質問または仮定として宣言したか" },
  { id: "R2_plan", label: "方針宣言", weight: 0.15, description: "実装前に全体方針を宣言し、宣言と実装が一致しているか。やらないことを明言したか" },
  { id: "R3_tradeoffs", label: "トレードオフ", weight: 0.10, description: "選択肢を比較し、採用理由と捨てたものを説明したか" },
  { id: "R4_correctness", label: "実装正確性", weight: 0.20, description: "要件を満たす動くコードか。テスト結果と要件チェックに基づく" },
  { id: "R5_testing", label: "テスト意識", weight: 0.10, description: "区切りごとに実行し、エッジケース（空入力・連打など）を予告して検証したか" },
  { id: "R6_time", label: "時間配分", weight: 0.10, description: "設計・実装・検証の配分が制限時間に対して妥当か。優先順位付けができたか" },
  { id: "R7_sync", label: "説明と実装の同期", weight: 0.10, description: "説明が実装に先行し、無発話で書き続ける区間が少ないか" },
  { id: "R8_attitude", label: "対話態度・復帰力", weight: 0.10, description: "詰まったときに状況を言語化し、方針転換を宣言して復帰できたか" },
];

export const Metrics = z.object({
  metrics_version: z.literal("1").default("1"),
  duration_s: z.number(),
  speech_total_s: z.number(),
  speech_ratio: z.number(),
  edit_total_events: z.number(),
  /** 説明が実装に先行した秒数の分布（説明セグメント開始 → 関連編集開始） */
  lead_time_s: z.object({ median: z.number().nullable(), p25: z.number().nullable(), p75: z.number().nullable(), samples: z.number() }),
  /** 15 秒超の沈黙。編集あり/なしで分ける */
  silence_gt15s: z.array(z.object({ t0: z.number(), t1: z.number(), dur_s: z.number(), editing: z.boolean() })),
  /** 無発話で編集していた時間の割合 */
  silent_edit_ratio: z.number(),
  /** 方針変更（大きな削除・巻き戻し・「やっぱり」等の言い直し）の推定回数 */
  direction_changes: z.array(z.object({ t: z.number(), kind: z.enum(["large_delete", "undo_burst", "verbal"]), detail: z.string() })),
  run_events: z.array(z.object({ t: z.number(), mode: z.string(), verdict: z.string().optional() })),
  /** 設計・実装・検証フェーズの推定 */
  phase_estimate: z.array(z.object({ phase: z.enum(["design", "implement", "verify", "polish", "idle"]), t0: z.number(), t1: z.number() })),
  /** talking_points の言及検出（文字起こしのキーワード一致、Claude の裁量評価前の機械判定） */
  talking_point_hits: z.array(z.object({ id: z.string(), t: z.number().nullable(), quote: z.string().nullable(), matched_terms: z.array(z.string()) })),
  restatements: z.number().default(0),
  filler_rate: z.number().default(0),
  paste_events: z.number().default(0),
  visibility_hidden_s: z.number().default(0),
});
export type Metrics = z.infer<typeof Metrics>;

export const Evidence = z.union([
  z.object({ type: z.literal("transcript"), t0: z.number(), t1: z.number(), quote: z.string() }),
  z.object({ type: z.literal("edit"), t: z.number(), file: z.string(), lines: z.tuple([z.number(), z.number()]).optional(), detail: z.string().optional() }),
  z.object({ type: z.literal("edit_absence"), symbol: z.string() }),
  z.object({ type: z.literal("metric"), name: z.string(), index: z.number().optional(), value: z.string().optional() }),
  z.object({ type: z.literal("run"), run_id: z.string(), verdict: z.string().optional() }),
  z.object({ type: z.literal("frame"), t: z.number() }),
]);
export type Evidence = z.infer<typeof Evidence>;

export const CodeRef = z.object({ file: z.string(), lines: z.tuple([z.number(), z.number()]), at: z.number() });

export const AxisScore = z.object({
  score: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  evidence: z.array(Evidence).default([]),
});

export const FeedbackItem = z.object({
  id: z.string(),
  t: z.number(),
  t_end: z.number().optional(),
  axis: Axis,
  severity: z.enum(["major", "minor", "positive"]),
  kind: z.enum(["gap", "silence", "strength", "bug", "tradeoff", "time", "question"]),
  title: z.string(),
  detail: z.string(),
  evidence: z.array(Evidence).default([]),
  code_ref: CodeRef.optional(),
  interviewer_question: z.string().optional(),
  /** evidence が検証できなかった項目は true（UI で「推測」バッジ） */
  speculative: z.boolean().default(false),
});
export type FeedbackItem = z.infer<typeof FeedbackItem>;

export const RequirementStatus = z.enum(["implemented", "mentioned_only", "missing"]);

export const Evaluation = z.object({
  schema_version: z.literal("1.0").default("1.0"),
  rubric_version: z.string(),
  session_id: z.string(),
  problem_id: z.string(),
  created_at: z.string(),
  model: z.string(),
  route: z.enum(["in_app_api", "mcp"]),
  prompt_hash: z.string().optional(),
  input_digest: z.object({ transcript_segments: z.number(), edit_events: z.number(), frames: z.number(), metrics_version: z.string() }),
  scores: z.object({
    R1_requirements: AxisScore,
    R2_plan: AxisScore,
    R3_tradeoffs: AxisScore,
    R4_correctness: AxisScore,
    R5_testing: AxisScore,
    R6_time: AxisScore,
    R7_sync: AxisScore,
    R8_attitude: AxisScore,
    overall: z.number().min(1).max(5),
  }),
  requirement_checklist: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: RequirementStatus,
      code_ref: CodeRef.optional(),
      mentioned_at: z.number().optional(),
    }),
  ),
  feedback: z.array(FeedbackItem),
  model_answer_comparison: z.object({
    covered: z.array(z.string()),
    missing: z.array(z.string()),
    beyond_model: z.array(z.string()),
    notes: z.string(),
  }),
  next_practice: z.array(z.object({ axis: Axis, action: z.string(), based_on: z.array(z.string()) })).max(3),
  summary: z.string(),
  uncertainties: z.array(z.string()).default([]),
  self_check: z.string().optional(),
});
export type Evaluation = z.infer<typeof Evaluation>;

/** 重み付き総合点。表示は控えめに（要件書 03 §3 FR-E-09） */
export function weightedOverall(scores: Record<Axis, { score: number }>): number {
  let sum = 0;
  for (const a of AXES) sum += scores[a.id].score * a.weight;
  return Math.round(sum * 10) / 10;
}
