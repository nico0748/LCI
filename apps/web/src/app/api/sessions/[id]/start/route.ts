// POST /api/sessions/[id]/start（W1、冪等）
export { POST_start as POST } from "@/lib/capture/server/sessions-api";
export const dynamic = "force-dynamic";
