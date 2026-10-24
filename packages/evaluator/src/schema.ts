import { z } from "zod";
import { Axis, Evaluation, weightedOverall, type Evidence } from "@lci/core";

/**
 * モデルに出力させる JSON のスキーマ（EvaluationDraft）と、core.Evaluation への変換。
 *
 * core.Evaluation をそのまま structured outputs に渡さない理由:
 * - メタ情報（rubric_version / model / prompt_hash / input_digest / created_at / route）はアプリが埋める。モデルに書かせると幻覚の余地が増える
 * - tuple（lines: [a, b]）は structured outputs の JSON Schema サブセットで表現できない（prefixItems 非対応）ので配列にして後で詰め直す
 * - SDK の zodOutputFormat は enum / const を description に移してしまい、軸名や severity が強制されない。
 *   ここでは enum / const を保ったまま、非対応の数値制約・配列長制約だけを説明文に移す自前変換を使う
 */

const SEC_DESC = "秒（セッション開始=0 の経過秒。アプリが保存時にミリ秒へ変換する）";

/**
 * draft スキーマの生成。sec を差し替えられるようにしているのは、MCP の save_evaluation で
 * "mm:ss" 文字列も受け付ける寛容版を作るため（API 経路は structured outputs で数値に固定）。
 */
function makeDraft<S extends z.ZodType<number | string>>(Sec: S) {
  const Lines = z.array(z.number().int()).describe("[開始行, 終了行]（スナップショットの行番号、2 要素）");
  const DraftCodeRef = z.object({ file: z.string(), lines: Lines, at: Sec.describe("参照したスナップショットの時刻（秒）") });

  const DraftEvidence = z.union([
    z.object({ type: z.literal("transcript"), t0: Sec, t1: Sec, quote: z.string().describe("原文の連続した一部を一字も変えずに 15〜60 文字") }),
    z.object({ type: z.literal("edit"), t: Sec, file: z.string(), lines: Lines.optional(), detail: z.string().optional() }),
    z.object({ type: z.literal("edit_absence"), symbol: z.string() }),
    z.object({ type: z.literal("metric"), name: z.string(), index: z.number().int().optional(), value: z.string().optional() }),
    z.object({ type: z.literal("run"), run_id: z.string(), verdict: z.string().optional() }),
    z.object({ type: z.literal("frame"), t: Sec }),
  ]);

  const DraftAxisScore = z.object({
    score: z.number().int().min(1).max(5),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
    evidence: z.array(DraftEvidence),
  });

  return z.object({
    scores: z.object({
      R1_requirements: DraftAxisScore,
      R2_plan: DraftAxisScore,
      R3_tradeoffs: DraftAxisScore,
      R4_correctness: DraftAxisScore,
      R5_testing: DraftAxisScore,
      R6_time: DraftAxisScore,
      R7_sync: DraftAxisScore,
      R8_attitude: DraftAxisScore,
    }),
    requirement_checklist: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        status: z.enum(["implemented", "mentioned_only", "missing"]),
        code_ref: DraftCodeRef.optional(),
        mentioned_at: Sec.optional(),
      }),
    ),
    feedback: z.array(
      z.object({
        id: z.string(),
        t: Sec,
        t_end: Sec.optional(),
        axis: Axis,
        severity: z.enum(["major", "minor", "positive"]),
        kind: z.enum(["gap", "silence", "strength", "bug", "tradeoff", "time", "question"]),
        title: z.string(),
        detail: z.string(),
        evidence: z.array(DraftEvidence),
        code_ref: DraftCodeRef.optional(),
        interviewer_question: z.string().optional(),
        speculative: z.boolean(),
      }),
    ),
    model_answer_comparison: z.object({
      covered: z.array(z.string()),
      missing: z.array(z.string()),
      beyond_model: z.array(z.string()),
      notes: z.string(),
    }),
    next_practice: z.array(z.object({ axis: Axis, action: z.string(), based_on: z.array(z.string()) })).max(3),
    summary: z.string(),
    uncertainties: z.array(z.string()),
    self_check: z.string(),
  });
}

export const EvaluationDraft = makeDraft(z.number().describe(SEC_DESC));
/** MCP 入力用: 時刻に "mm:ss" も許す（normalizeDraftTimes で秒に直してから EvaluationDraft で検証する） */
export const LenientEvaluationDraft = makeDraft(z.union([z.number(), z.string()]).describe(`${SEC_DESC}。"mm:ss" 文字列も可`));
export type EvaluationDraft = z.infer<typeof EvaluationDraft>;

/** structured outputs が受け付けない（または無視する）キー。値は説明文に移す */
const MOVE_TO_DESCRIPTION = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "maxItems", "minLength", "maxLength", "pattern", "default"];

type JsonObj = Record<string, unknown>;

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (!node || typeof node !== "object") return node;
  const src = node as JsonObj;
  const out: JsonObj = {};
  const moved: string[] = [];
  for (const [k, v] of Object.entries(src)) {
    if (k === "$schema") continue;
    if ((k === "properties" || k === "$defs") && v && typeof v === "object") {
      // プロパティ名の表（キーはスキーマ語彙ではない）なので値だけ変換する
      out[k] = Object.fromEntries(Object.entries(v as JsonObj).map(([name, sub]) => [name, sanitize(sub)]));
      continue;
    }
    if (MOVE_TO_DESCRIPTION.includes(k)) {
      moved.push(`${k}: ${JSON.stringify(v)}`);
      continue;
    }
    if (k === "minItems" && typeof v === "number" && v > 1) {
      moved.push(`minItems: ${v}`);
      continue;
    }
    if (k === "oneOf") {
      out.anyOf = sanitize(v);
      continue;
    }
    out[k] = sanitize(v);
  }
  if (out.type === "object") out.additionalProperties = false;
  if (moved.length) out.description = `${typeof out.description === "string" ? `${out.description} ` : ""}{${moved.join(", ")}}`;
  return out;
}

/** EvaluationDraft の JSON Schema（output_config.format.schema に渡す） */
export function draftJsonSchema(): JsonObj {
  const raw = z.toJSONSchema(EvaluationDraft, { target: "draft-2020-12", io: "output", unrepresentable: "any", reused: "ref" });
  return sanitize(raw) as JsonObj;
}

export interface DraftMeta {
  session_id: string;
  problem_id: string;
  model: string;
  route: "in_app_api" | "mcp";
  rubric_version: string;
  prompt_hash?: string;
  input_digest: Evaluation["input_digest"];
  created_at?: string;
  /** セッション長（ms）。モデルが誤ってミリ秒で返した値を見分けるのに使う */
  duration_ms?: number;
}

/** 時刻を表すキー。draft では秒、core.Evaluation ではセッション時計のミリ秒 */
export const TIME_KEYS = new Set(["t", "t_end", "t0", "t1", "at", "mentioned_at"]);

/** "mm:ss" / "hh:mm:ss" / "123s" → 秒。数値ならそのまま */
export function parseTimeToSec(v: unknown): number | unknown {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return v;
  const s = v.trim();
  const m = /^(?:(\d+):)?(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const n = /^(\d+(?:\.\d+)?)\s*(s|秒)?$/.exec(s);
  if (n) return Number(n[1]);
  return v;
}

/** 入力中の時刻キーの "mm:ss" 文字列を秒に直す（MCP 経由で Claude が mm:ss を書いてきた場合の救済） */
export function normalizeDraftTimes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeDraftTimes);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = TIME_KEYS.has(k) ? parseTimeToSec(v) : normalizeDraftTimes(v);
  }
  return out;
}

/**
 * 秒 → ミリ秒。ただし値がセッション長（秒）を大きく超え、かつミリ秒としてなら範囲内に収まるときは
 * 既にミリ秒で書かれていると判断してそのまま使う。
 */
export function secToMs(sec: number, duration_ms?: number): number {
  if (duration_ms && duration_ms > 0) {
    const durS = duration_ms / 1000;
    if (sec > durS + 120 && sec <= duration_ms + 120_000) return Math.round(sec);
  }
  return Math.round(sec * 1000);
}

function toTuple(xs: number[] | undefined): [number, number] | undefined {
  if (!xs || !xs.length) return undefined;
  const a = xs[0]!;
  const b = xs.length > 1 ? xs[xs.length - 1]! : a;
  return a <= b ? [a, b] : [b, a];
}

type DraftEvidence = EvaluationDraft["feedback"][number]["evidence"][number];
type DraftCodeRef = NonNullable<EvaluationDraft["feedback"][number]["code_ref"]>;

function convEvidence(e: DraftEvidence, ms: (s: number) => number): Evidence {
  switch (e.type) {
    case "transcript":
      return { ...e, t0: ms(e.t0), t1: ms(e.t1) };
    case "edit": {
      const { lines, ...rest } = e;
      const tl = toTuple(lines);
      return tl ? { ...rest, t: ms(e.t), lines: tl } : { ...rest, t: ms(e.t) };
    }
    case "frame":
      return { ...e, t: ms(e.t) };
    default:
      return e;
  }
}

function convCodeRef(c: DraftCodeRef | undefined, ms: (s: number) => number) {
  if (!c) return undefined;
  const lines = toTuple(c.lines);
  return lines ? { file: c.file, lines, at: ms(c.at) } : undefined;
}

/**
 * モデル出力（draft、時刻は秒）＋アプリ側メタ → core.Evaluation（時刻はセッション時計 ms、overall はアプリで再計算）
 */
export function draftToEvaluation(draft: EvaluationDraft, meta: DraftMeta): Evaluation {
  const ms = (sec: number) => secToMs(sec, meta.duration_ms);
  const ce = (e: DraftEvidence) => convEvidence(e, ms);
  const scores = Object.fromEntries(
    Object.entries(draft.scores).map(([k, v]) => [k, { ...v, evidence: v.evidence.map(ce) }]),
  ) as Record<Axis, Evaluation["scores"]["R1_requirements"]>;
  return Evaluation.parse({
    schema_version: "1.0",
    rubric_version: meta.rubric_version,
    session_id: meta.session_id,
    problem_id: meta.problem_id,
    created_at: meta.created_at ?? new Date().toISOString(),
    model: meta.model,
    route: meta.route,
    prompt_hash: meta.prompt_hash,
    input_digest: meta.input_digest,
    scores: { ...scores, overall: weightedOverall(scores) },
    requirement_checklist: draft.requirement_checklist.map((r) => ({
      id: r.id,
      label: r.label,
      status: r.status,
      ...(convCodeRef(r.code_ref, ms) ? { code_ref: convCodeRef(r.code_ref, ms) } : {}),
      ...(r.mentioned_at !== undefined ? { mentioned_at: ms(r.mentioned_at) } : {}),
    })),
    feedback: draft.feedback
      .map((f) => ({
        ...f,
        t: ms(f.t),
        ...(f.t_end !== undefined ? { t_end: ms(f.t_end) } : {}),
        evidence: f.evidence.map(ce),
        code_ref: convCodeRef(f.code_ref, ms),
      }))
      .sort((a, b) => a.t - b.t),
    model_answer_comparison: draft.model_answer_comparison,
    next_practice: draft.next_practice.slice(0, 3),
    summary: draft.summary,
    uncertainties: draft.uncertainties,
    self_check: draft.self_check,
  });
}
