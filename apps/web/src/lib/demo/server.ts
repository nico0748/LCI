import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { DemoIdError, DemoService, assertAudioKey, assertDemoId, assertRevision } from "@lci/demo";
import { getRunner } from "@lci/runner";
import { DATA_ROOT, PROBLEMS_ROOT, REPO_ROOT } from "@/lib/paths";

/**
 * /api/demos/* の共有ヘルパ（demo-backend）。本体は @lci/demo の DemoService（MCP サーバと同じもの、02 結論 8）。
 * - 録画中はすべての API が 409 {error:"recording"}（D15。録画のディスク・CPU を奪わない）
 * - id は正規表現で検査し、data/demos の外は参照しない（不正なら 400）
 * - 台本の中身（コード・ナレーション）と音声は ?reveal=1 のときだけ返す（D14 のネタバレ配慮。一覧は中身を含まない）
 */

type Ctx<P> = { params: Promise<P> };
export type DemoCtx = Ctx<{ demo_id: string }>;
export type DemoAudioCtx = Ctx<{ demo_id: string; key: string }>;

/** Next の dev はモジュールを再評価することがあるので globalThis に保持する（lib/server.ts と同じ理由） */
const g = globalThis as unknown as { __lciDemo?: DemoService };

export function demoService(): DemoService {
  g.__lciDemo ??= new DemoService({
    dataRoot: DATA_ROOT,
    problemsRoot: PROBLEMS_ROOT,
    // 検証（v1.1 のアプリ内生成）でだけ使う。warm() が docker/ を見つけられるようリポジトリルートから渡す
    runner: () => getRunner({ dockerDir: process.env.LCI_DOCKER_DIR ?? path.join(REPO_ROOT, "docker") }),
  });
  return g.__lciDemo;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** 録画中なら 409 を返す（D15）。録画していなければ null */
export async function busyResponse(): Promise<Response | null> {
  const ids = await demoService().busy();
  if (!ids.length) return null;
  return json({ error: "recording", message: "録画中のセッションがあります。録画を終えてからデモを開いてください", sessions: ids }, 409);
}

export function revealed(req: Request): boolean {
  return new URL(req.url).searchParams.get("reveal") === "1";
}

/** 403: 本体はネタバレを含むので ?reveal=1 が要る */
export function revealRequired(): Response {
  return bad("デモの中身は解答を含みます。?reveal=1 を付けて取得してください", 403);
}

/** ?revision=N を読む（無ければ undefined、不正なら DemoIdError） */
export function revisionParam(req: Request): number | undefined {
  const raw = new URL(req.url).searchParams.get("revision");
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  assertRevision(n);
  return n;
}

/** 入力の検査とエラーの変換をまとめる: DemoIdError → 400、それ以外 → 500 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DemoIdError) return bad(e.message, 400);
    console.error("[api/demos]", e);
    return bad(e instanceof Error ? e.message : String(e), 500);
  }
}

export async function demoIdOf(ctx: DemoCtx | DemoAudioCtx): Promise<string> {
  const { demo_id } = await ctx.params;
  assertDemoId(demo_id);
  return demo_id;
}

/**
 * 音声区間（audio/mp4）。キーは内容ハッシュなので immutable でキャッシュしてよい。Range 対応（Safari の audio は Range を要求する）
 */
export async function audioFileResponse(req: Request, demoId: string, key: string): Promise<Response> {
  assertAudioKey(key.replace(/\.m4a$/, ""));
  const file = await demoService().store.segmentPath(demoId, key.replace(/\.m4a$/, ""));
  if (!file) return bad("デモが見つかりません", 404);
  const st = await fs.stat(/*turbopackIgnore: true*/ file).catch(() => null);
  if (!st?.isFile() || st.size === 0) return bad("音声がありません", 404);
  const size = st.size;
  const range = req.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1] === "" && m[2] !== "") start = Math.max(0, size - Number(m[2]));
    else {
      start = Number(m[1] || 0);
      if (m[2] !== "") end = Math.min(size - 1, Number(m[2]));
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }
  const headers: Record<string, string> = {
    "Content-Type": "audio/mp4",
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  if (req.method === "HEAD") return new Response(null, { status, headers });
  // data/ 配下は実行時にしか決まらないので、ビルド時のファイルトレースから外す
  const body = Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ file, { start, end })) as unknown as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}
