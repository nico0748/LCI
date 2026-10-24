// POST /api/judge（R）。stdio / unit 問題を採点する。
// body { session_id?, problem_id, language, files, t?, seq?, visibility? } → RunResult（mode judge）
// visibility: "sample" で sample ケースのみ（Run ボタン相当）、既定 "all"（Submit）。
import { Language } from "@lci/core";
import { z } from "zod";
import { problem } from "@/lib/server";
import { PROBLEMS_ROOT } from "@/lib/paths";
import { FileInput, bad, json, recordRun, runner } from "../runner/_shared/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  session_id: z.string().optional(),
  problem_id: z.string(),
  language: Language,
  files: z.array(FileInput).min(1).max(20),
  t: z.number().optional(),
  seq: z.number().int().optional(),
  visibility: z.enum(["sample", "all"]).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("リクエストが不正です: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
  const b = parsed.data;
  const p = await problem(b.problem_id);
  if (!p) return bad(`問題が見つかりません: ${b.problem_id}`, 404);
  if (p.tests.kind !== "stdio" && p.tests.kind !== "unit") return bad(`kind=${p.tests.kind} はサーバ側で採点しません（web はブラウザ内で判定し /api/sessions/[id]/runs に保存）`);
  if (!p.meta.languages.includes(b.language)) return bad(`この問題は ${b.language} に対応していません（${p.meta.languages.join(", ")}）`);
  const result = await runner().judge(p, { language: b.language, files: b.files, t: b.t ?? 0, problemsRoot: PROBLEMS_ROOT, visibility: b.visibility });
  if (b.session_id) {
    const ref = await recordRun(b.session_id, result, { file: b.files[0]?.path, seq: b.seq });
    if (ref === null) return json({ ...result, warning: "セッションが見つからないため結果を保存しませんでした" });
  }
  return json(result);
}
