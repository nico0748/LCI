// GET  /api/demos/<demo_id>/audio[?revision=N] → AudioJobStatus（合成の進捗。ポーリング用）
// POST /api/demos/<demo_id>/audio[?revision=N][&force=1] → 202 { status: "started" | "generating", total }
//      / 200 { status: "ready" } / 409 { error: "unavailable", reason }（say や ffmpeg が無い）
// （demo-backend、02 §7.2）。合成はこのプロセスで待たずに進める。録画中は 409（D15）
import { busyResponse, demoIdOf, demoService, handle, json, bad, revisionParam, type DemoCtx } from "@/lib/demo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: DemoCtx) {
  return handle(async () => {
    const id = await demoIdOf(ctx);
    const revision = revisionParam(req);
    const busy = await busyResponse();
    if (busy) return busy;
    const st = await demoService().audioStatus(id, revision);
    if (!st) return bad(`デモが見つかりません: ${id}`, 404);
    return json(st);
  });
}

export async function POST(req: Request, ctx: DemoCtx) {
  return handle(async () => {
    const id = await demoIdOf(ctx);
    const revision = revisionParam(req);
    const force = new URL(req.url).searchParams.get("force") === "1";
    const busy = await busyResponse();
    if (busy) return busy;
    const r = await demoService().startAudio(id, { revision, force });
    switch (r.status) {
      case "not_found":
        return bad(`デモが見つかりません: ${id}${revision ? ` rev ${revision}` : ""}`, 404);
      case "unavailable":
        return json({ error: "unavailable", reason: r.reason, revision: r.revision }, 409);
      case "ready":
        return json(r, 200);
      default:
        return json(r, 202);
    }
  });
}
