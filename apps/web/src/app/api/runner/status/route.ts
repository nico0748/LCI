// GET /api/runner/status（R）→ { docker: "ok"|"not_running"|"missing", backend, images: {lang, image, present}[], containers: {lang, name, state}[] }
import { json, runner } from "../_shared/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json(await runner().status());
}
