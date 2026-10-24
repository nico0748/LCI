import { getProblemForApi } from "@/lib/review/problems-api";

export const dynamic = "force-dynamic";

/** GET /api/problems/[id] → Problem（`?reveal=1` のときだけ非公開部分と参照解本文を含む） */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const reveal = new URL(req.url).searchParams.get("reveal") === "1";
  const p = await getProblemForApi(id, reveal);
  if (!p) return Response.json({ error: "problem not found" }, { status: 404 });
  return Response.json(p);
}
