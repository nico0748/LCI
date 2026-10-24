// POST /api/run（R）。採点なしの実行。body { session_id?, language, files, entry?, stdin?, t?, seq? } → RunResult（mode run）
import { Language } from "@lci/core";
import { z } from "zod";
import { FileInput, bad, json, recordRun, runner } from "../runner/_shared/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  session_id: z.string().optional(),
  language: Language,
  files: z.array(FileInput).min(1).max(20),
  entry: z.string().optional(),
  stdin: z.string().max(4 * 1024 * 1024).optional(),
  t: z.number().optional(),
  seq: z.number().int().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("リクエストが不正です: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
  const b = parsed.data;
  const result = await runner().run({ language: b.language, files: b.files, entry: b.entry, stdin: b.stdin, t: b.t ?? 0 });
  if (b.session_id) {
    const ref = await recordRun(b.session_id, result, { file: b.entry ?? b.files[0]?.path, seq: b.seq });
    if (ref === null) return json({ ...result, warning: "セッションが見つからないため結果を保存しませんでした" });
  }
  return json(result);
}
