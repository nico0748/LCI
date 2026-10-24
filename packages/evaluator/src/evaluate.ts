import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { RUBRIC_VERSION, fmtT, type Evaluation, type SessionStore } from "@lci/core";
import { buildEvaluationContext, type EvaluationContext } from "./context.ts";
import { PROMPT_VERSION, SYSTEM_PROMPT, promptHash } from "./prompt.ts";
import { EvaluationDraft, draftJsonSchema, draftToEvaluation } from "./schema.ts";
import { verifyEvaluation } from "./verify.ts";

/**
 * アプリ内評価（03 §4.5 の主経路）。Anthropic Messages API を structured outputs で呼ぶ。
 * - モデル既定 claude-opus-5-5、thinking は adaptive、effort は high を明示（Opus 5.5 の既定は medium）
 * - system（ルーブリック＋few-shot）は固定文面にして cache_control で prompt caching
 * - 長い出力になりうるのでストリーミング＋finalMessage()
 * - 安全分類器の誤判定に備えて server-side fallback（fallbacks: "default"）を付ける
 */

export const DEFAULT_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class NoApiKeyError extends Error {
  readonly code = "no_api_key";
  constructor() {
    super("ANTHROPIC_API_KEY が設定されていません。apps/web/.env.local に設定するか、MCP 経由（Claude Desktop / Claude Code）で評価してください");
    this.name = "NoApiKeyError";
  }
}

export class EvaluationFailedError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "EvaluationFailedError";
  }
}

export interface EvaluateInput {
  store: SessionStore;
  problemsRoot: string;
  sessionId: string;
  model?: string;
  includeFrames?: boolean;
  apiKey?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** true なら API を呼ばずにプロンプトと入力を返す（テスト・デバッグ用） */
  dryRun?: boolean;
  /** テスト用に差し替え可能なクライアント */
  client?: Anthropic;
  log?: (msg: string) => void;
}

export interface BuiltRequest {
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: Record<string, unknown>;
  prompt_hash: string;
  prompt_version: string;
  context: EvaluationContext;
}

export interface DryRunResult extends Omit<BuiltRequest, "context"> {
  dry_run: true;
  model: string;
  estimated_tokens: number;
  input_digest: Evaluation["input_digest"];
  truncation: string[];
  /** 画像を除いたユーザメッセージ本文 */
  user_text: string;
}

export function buildRequest(context: EvaluationContext): BuiltRequest {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: context.text }];
  for (const f of context.frames) {
    content.push({ type: "text", text: `画面キーフレーム t=${fmtT(f.t)}（${Math.round(f.t / 1000)}s, ${f.reason}）` });
    content.push({ type: "image", source: { type: "base64", media_type: f.media_type, data: f.data } });
  }
  content.push({
    type: "text",
    text: "以上の素材から、ルーブリックと証拠のルールに従って評価 JSON を出力してください。時刻はすべて経過秒（mm:ss を秒に直した数値。アプリがミリ秒に変換して保存する）。transcript の引用は原文から一字も変えずに抜くこと。",
  });
  return {
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    schema: draftJsonSchema(),
    prompt_hash: promptHash(),
    prompt_version: PROMPT_VERSION,
    context,
  };
}

/** 入力の同一性確認用（再評価の比較）。画像はハッシュだけ含める */
export function inputHash(context: EvaluationContext): string {
  const h = createHash("sha256").update(context.text);
  for (const f of context.frames) h.update(f.data);
  return `sha256:${h.digest("hex")}`;
}

export async function evaluateSession(input: EvaluateInput & { dryRun: true }): Promise<DryRunResult>;
export async function evaluateSession(input: EvaluateInput & { dryRun?: false }): Promise<Evaluation>;
export async function evaluateSession(input: EvaluateInput): Promise<Evaluation | DryRunResult>;
export async function evaluateSession(input: EvaluateInput): Promise<Evaluation | DryRunResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const log = input.log ?? (() => {});
  const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!input.dryRun && !input.client && !apiKey) throw new NoApiKeyError();

  const context = await buildEvaluationContext({
    store: input.store,
    problemsRoot: input.problemsRoot,
    sessionId: input.sessionId,
    includeFrames: input.includeFrames ?? true,
  });
  const req = buildRequest(context);

  if (input.dryRun) {
    const { context: _c, ...rest } = req;
    return {
      ...rest,
      dry_run: true,
      model,
      estimated_tokens: context.estimated_tokens,
      input_digest: context.input_digest,
      truncation: context.truncation,
      user_text: context.text,
    };
  }

  const client = input.client ?? new Anthropic({ apiKey, timeout: 15 * 60_000 });
  const started = Date.now();
  let lastError = "";
  // FR-E-10: パース失敗時は 1 回だけ自動リトライ
  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`[evaluate] request attempt ${attempt} model=${model} est_tokens=${context.estimated_tokens}`);
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 64_000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: input.effort ?? "high", format: { type: "json_schema", schema: req.schema } },
      system: req.system,
      messages: req.messages,
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") {
      throw new EvaluationFailedError("refusal", `モデルが評価を拒否しました（${msg.stop_details?.category ?? "unknown"}）。MCP 経由での評価を試してください`);
    }
    if (msg.stop_reason === "max_tokens") {
      lastError = "出力が max_tokens に達して途中で切れました";
      continue;
    }
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let draft: EvaluationDraft;
    try {
      draft = EvaluationDraft.parse(JSON.parse(text));
    } catch (e) {
      lastError = `構造化出力のパースに失敗: ${(e as Error).message.slice(0, 500)}`;
      log(`[evaluate] ${lastError}`);
      continue;
    }
    const ev = draftToEvaluation(draft, {
      session_id: context.session.session_id,
      problem_id: context.session.problem.id,
      model: msg.model ?? model,
      route: "in_app_api",
      rubric_version: RUBRIC_VERSION,
      prompt_hash: req.prompt_hash,
      input_digest: context.input_digest,
      duration_ms: context.session.ended_t,
    });
    const verified = verifyEvaluation(ev, context.transcript?.segments ?? []);
    const evaluation: Evaluation = {
      ...verified.evaluation,
      usage: {
        input_tokens: msg.usage.input_tokens,
        output_tokens: msg.usage.output_tokens,
        cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
        elapsed_ms: Date.now() - started,
      },
    };
    if (context.truncation.length) evaluation.uncertainties.push(`[入力省略] ${context.truncation.join("、")}`);
    await input.store.saveEvaluation(input.sessionId, evaluation);
    log(`[evaluate] saved. overall=${evaluation.scores.overall} demoted=${verified.demoted.length}`);
    return evaluation;
  }
  throw new EvaluationFailedError("parse_failed", lastError || "評価に失敗しました");
}
