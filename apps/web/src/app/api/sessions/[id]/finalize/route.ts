// POST /api/sessions/[id]/finalize（E）。再 mux → 音声抽出 → whisper → transcript → metrics → frames → ready。
// 冪等: 何度呼んでもよい。同じセッションの finalize が走っている最中なら待たずに 202 を返す
// （/end からの fire-and-forget とレビュー画面の「再処理」ボタンが重なるため）。
import { NextResponse } from "next/server";
import { finalizeSession, isFinalizing } from "@lci/evaluator";
import { store } from "@/lib/server";
import { PROBLEMS_ROOT } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const st = store();
  const s = await st.get(id);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (isFinalizing(id)) return NextResponse.json({ status: "finalizing" }, { status: 202 });

  const body = (await req.json().catch(() => ({}))) as { force?: boolean; skip_transcribe?: boolean; allow_cam_frames?: boolean; wait?: boolean };
  // 録画中のセッションを finalize すると .part を奪ってしまうので拒否する（end を先に呼ぶ）
  if (s.status === "recording" || s.status === "preparing") {
    return NextResponse.json({ error: "not_ended", status: s.status }, { status: 409 });
  }
  const run = finalizeSession(st, id, {
    problemsRoot: PROBLEMS_ROOT,
    force: body.force === true,
    skipTranscribe: body.skip_transcribe === true,
    allowCamFrames: body.allow_cam_frames === true,
    log: (m) => console.log(m),
  });
  if (body.wait === false) {
    run.catch((e) => console.error("[finalize]", e));
    return NextResponse.json({ status: "finalizing" }, { status: 202 });
  }
  try {
    const done = await run;
    return NextResponse.json({ status: done.status, stt: done.stt ?? null, finalize: done.finalize ?? null, warnings: done.warnings });
  } catch (e) {
    return NextResponse.json({ error: "finalize_failed", message: (e as Error).message }, { status: 500 });
  }
}
