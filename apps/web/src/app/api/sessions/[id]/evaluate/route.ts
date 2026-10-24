// POST /api/sessions/[id]/evaluate（E）。body { model?, include_frames? } → 保存済み Evaluation。
// ANTHROPIC_API_KEY が無いときは 503 { error: "no_api_key" }（UI は MCP 経由を案内する）。
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EvaluationFailedError, NoApiKeyError, evaluateSession } from "@lci/evaluator";
import { store } from "@/lib/server";
import { PROBLEMS_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// adaptive thinking + effort high で 1〜3 分かかる（03 §8.2）
export const maxDuration = 600;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  const st = store();
  const s = await st.get(id);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (s.status !== "ready") return NextResponse.json({ error: "not_ready", status: s.status }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { model?: string; include_frames?: boolean };
  try {
    const ev = await evaluateSession({
      store: st,
      problemsRoot: PROBLEMS_ROOT,
      sessionId: id,
      model: typeof body.model === "string" && body.model ? body.model : undefined,
      includeFrames: body.include_frames !== false,
      log: (m) => console.log(m),
    });
    return NextResponse.json(ev);
  } catch (e) {
    if (e instanceof NoApiKeyError) return NextResponse.json({ error: "no_api_key" }, { status: 503 });
    if (e instanceof EvaluationFailedError) return NextResponse.json({ error: e.code, message: e.message }, { status: 502 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "invalid_api_key", message: e.message }, { status: 401 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited", message: e.message }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: "api_error", status: e.status ?? null, message: e.message }, { status: 502 });
    return NextResponse.json({ error: "evaluate_failed", message: (e as Error).message }, { status: 500 });
  }
}
