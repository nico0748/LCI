// GET /api/sessions（W2）。POST は W1 が追加する。本体は lib/review/sessions-api.ts。
export { GET_sessions as GET } from "@/lib/review/sessions-api";
export const dynamic = "force-dynamic";
// POST /api/sessions（W1）。本体は lib/capture/server/sessions-api.ts。
export { POST_sessions as POST } from "@/lib/capture/server/sessions-api";
