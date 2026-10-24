// GET/DELETE /api/sessions/[id]（W2）。本体は lib/review/sessions-api.ts。
export { GET_session as GET, DELETE_session as DELETE } from "@/lib/review/sessions-api";
export const dynamic = "force-dynamic";
