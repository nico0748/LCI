import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { buildTimeline, reconstructFileAt, type Metrics, type Session } from "@lci/core";
import { store } from "@/lib/server";

/**
 * セッション API の読み取り系（W2）。
 * Route Handler 本体はここに置き、`route.ts` からは re-export するだけにする。
 * 同じ route.ts に W1 の POST/PUT が同居しても、衝突が 1 行の export で済むようにするため。
 */

type Ctx<P> = { params: Promise<P> };

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function listSessions(): Promise<Session[]> {
  return store().list();
}

/** GET /api/sessions */
export async function GET_sessions() {
  return json(await listSessions());
}

/** GET /api/sessions/[id] */
export async function GET_session(_req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const s = store();
  const session = await s.get(id);
  if (!session) return json({ error: "session not found" }, { status: 404 });
  const events = await s.readEvents(id);
  const transcript = await s.getTranscript(id);
  return json({ session, events_count: events.length, has_transcript: !!transcript, evaluations: session.evaluations.length });
}

/** レビュー画面の初期データ。ページと API で共有する */
export async function loadTimeline(id: string) {
  const s = store();
  const session = await s.get(id);
  if (!session) return null;
  const [events, transcript, metrics] = await Promise.all([s.readEvents(id), s.getTranscript(id), s.getMetrics<Metrics>(id)]);
  const rows = transcript ? buildTimeline(transcript.segments, events) : [];
  return { session, events, transcript, metrics, rows };
}
export type TimelineResponse = NonNullable<Awaited<ReturnType<typeof loadTimeline>>>;

/** GET /api/sessions/[id]/timeline */
export async function GET_timeline(_req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const data = await loadTimeline(id);
  if (!data) return json({ error: "session not found" }, { status: 404 });
  return json(data);
}

/** GET /api/sessions/[id]/snapshot-at?file=&t= */
export async function GET_snapshotAt(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const file = url.searchParams.get("file");
  const t = Number(url.searchParams.get("t"));
  if (!file || !Number.isFinite(t)) return json({ error: "file と t が必要です" }, { status: 400 });
  const s = store();
  const session = await s.get(id);
  if (!session) return json({ error: "session not found" }, { status: 404 });
  const events = await s.readEvents(id);
  const result = await reconstructFileAt(events, file, t, {
    read: (ref) => s.readRel(id, ref),
  });
  return json(result, { headers: { "Cache-Control": "private, max-age=3600" } });
}

/** GET /api/sessions/[id]/evaluations */
export async function GET_evaluations(_req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  return json(await store().getEvaluations(id));
}

/**
 * GET /api/sessions/[id]/media/[recorder]
 * `media/<recorder>.webm` を Range 対応で返す。再 mux 前（録画中・finalize 失敗時）は `.webm.part` にフォールバックする。
 */
export async function GET_media(req: Request, ctx: Ctx<{ id: string; recorder: string }>) {
  const { id, recorder } = await ctx.params;
  if (recorder !== "cam" && recorder !== "screen") return json({ error: "unknown recorder" }, { status: 404 });
  const s = store();
  const session = await s.get(id);
  if (!session) return json({ error: "session not found" }, { status: 404 });
  const rec = session.recorders.find((r) => r.id === recorder);
  const dir = s.dir(id);
  // session.json の file を優先し、無ければ既定の名前を試す。ディレクトリ外は拒否
  const candidates = [rec?.file, `media/${recorder}.webm`, `media/${recorder}.webm.part`]
    .filter((f): f is string => !!f)
    .flatMap((f) => (f.endsWith(".part") ? [f] : [f, `${f}.part`]))
    .map((f) => path.resolve(dir, f))
    .filter((abs) => abs.startsWith(dir + path.sep));
  let abs: string | null = null;
  let size = 0;
  for (const c of candidates) {
    const st = await fs.stat(c).catch(() => null);
    if (st?.isFile() && st.size > 0) {
      abs = c;
      size = st.size;
      break;
    }
  }
  if (!abs) return json({ error: "media not found" }, { status: 404 });

  const mime = (rec?.mime ?? "video/webm").split(";")[0] || "video/webm";
  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1] === "" && m[2] !== "") {
      // 末尾 N バイト
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1] || 0);
      if (m[2] !== "") end = Math.min(size - 1, Number(m[2]));
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "no-store",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  if (req.method === "HEAD") return new Response(null, { status, headers });
  // data/ 配下は実行時にしか決まらないので、ビルド時のファイルトレースから外す
  const nodeStream = createReadStream(/*turbopackIgnore: true*/ abs, { start, end });
  const body = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}

/** DELETE /api/sessions/[id]: 録画・ログ・評価を含むセッションディレクトリを削除する */
export async function DELETE_session(_req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  try {
    const removed = await store().remove(id);
    if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }
}
