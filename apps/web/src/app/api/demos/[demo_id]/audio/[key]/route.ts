// GET /api/demos/<demo_id>/audio/<key>?reveal=1 → audio/mp4（AAC の音声区間。Range 対応・immutable）
// （demo-backend）。key は 16 桁の内容ハッシュ（AudioManifest.segments[].key）。録画中は 409（D15）、reveal=1 が要る（D14）
import { audioFileResponse, busyResponse, handle, revealRequired, revealed, type DemoAudioCtx } from "@/lib/demo/server";
import { assertDemoId } from "@lci/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serve(req: Request, ctx: DemoAudioCtx) {
  return handle(async () => {
    const { demo_id, key } = await ctx.params;
    assertDemoId(demo_id);
    const busy = await busyResponse();
    if (busy) return busy;
    if (!revealed(req)) return revealRequired();
    return audioFileResponse(req, demo_id, key);
  });
}

export { serve as GET, serve as HEAD };
