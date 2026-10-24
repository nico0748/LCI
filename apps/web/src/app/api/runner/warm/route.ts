// POST /api/runner/warm（R）。イメージを docker/ からビルドしてウォームコンテナを起動する。
// body（任意）{ languages?: RunnerLanguage[], rebuild?: boolean } → text/event-stream
//   event: progress  data: WarmProgress（{ lang, phase, message?, line? }）
//   event: done      data: RunnerStatus（最終状態）
import { RUNNER_LANGUAGES } from "@lci/runner";
import { z } from "zod";
import { bad, runner } from "../_shared/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 初回ビルドは数分かかる
export const maxDuration = 1800;

const Body = z.object({ languages: z.array(z.enum(RUNNER_LANGUAGES)).optional(), rebuild: z.boolean().optional() });

/** 同時に 2 本の warm が走ると同じイメージを二重ビルドするので、実行中は 409 を返す */
const g = globalThis as unknown as { __lciWarming?: boolean };

export async function POST(req: Request) {
  const raw = await req.text();
  const parsed = Body.safeParse(raw.trim() ? JSON.parse(raw) : {});
  if (!parsed.success) return bad("リクエストが不正です");
  if (g.__lciWarming) return bad("イメージ取得はすでに実行中です", 409);
  g.__lciWarming = true;

  const r = runner();
  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) => {
    c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        for await (const p of r.warm(parsed.data)) {
          // ブラウザが閉じられてもビルドは最後まで続ける（中断するとイメージが中途半端になる）
          if (!cancelled) send(c, "progress", p);
        }
        if (!cancelled) send(c, "done", await r.status());
      } catch (e) {
        if (!cancelled) send(c, "progress", { lang: "all", phase: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        g.__lciWarming = false;
        if (!cancelled) c.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
