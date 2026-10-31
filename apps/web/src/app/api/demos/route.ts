// GET /api/demos?problem=<id>&language=<lang>（demo-backend）。保存済みデモの一覧（新しい順、DemoSummary[]）。
// 中身（コード・ナレーション）を含まないので reveal は要らない。録画中は 409（D15）
import { assertLanguage, assertProblemId } from "@lci/demo";
import { busyResponse, demoService, handle, json } from "@/lib/demo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const busy = await busyResponse();
    if (busy) return busy;
    const q = new URL(req.url).searchParams;
    const problem_id = q.get("problem") || undefined;
    const language = q.get("language") || undefined;
    if (problem_id !== undefined) assertProblemId(problem_id);
    if (language !== undefined) assertLanguage(language);
    return json(await demoService().summaries({ problem_id, language }));
  });
}
