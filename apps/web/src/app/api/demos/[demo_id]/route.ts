// GET    /api/demos/<demo_id>?reveal=1[&revision=N] → DemoDetail（台本・再生用に組み立てたもの・音声マニフェスト・版の一覧）
// DELETE /api/demos/<demo_id>[?revision=N][&audio_only=1] → { deleted, demo_deleted, freed_bytes }
// （demo-backend）。録画中は 409（D15）、本体は reveal=1 が要る（D14）
import { busyResponse, demoIdOf, demoService, handle, json, bad, revealRequired, revealed, revisionParam, type DemoCtx } from "@/lib/demo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: DemoCtx) {
  return handle(async () => {
    const id = await demoIdOf(ctx);
    const revision = revisionParam(req);
    const busy = await busyResponse();
    if (busy) return busy;
    if (!revealed(req)) return revealRequired();
    const d = await demoService().detail(id, revision);
    if (!d) return bad(revision ? `デモ ${id} の版 ${revision} が見つかりません` : `デモが見つかりません: ${id}`, 404);
    return json(d);
  });
}

export async function DELETE(req: Request, ctx: DemoCtx) {
  return handle(async () => {
    const id = await demoIdOf(ctx);
    const revision = revisionParam(req);
    const audioOnly = new URL(req.url).searchParams.get("audio_only") === "1";
    const busy = await busyResponse();
    if (busy) return busy;
    const r = await demoService().remove(id, { revision, audioOnly });
    if (!r) return bad(`デモが見つかりません: ${id}${revision ? ` rev ${revision}` : ""}`, 404);
    return json({ deleted: true, ...r });
  });
}
