import { listProblemSummaries } from "@/lib/review/problems-api";

export const dynamic = "force-dynamic";

/** GET /api/problems → ProblemSummary[] */
export async function GET() {
  return Response.json(await listProblemSummaries());
}
