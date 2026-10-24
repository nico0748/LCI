// POST /api/sessions/[id]/end（W1）。events を close し finalize を fire-and-forget で呼ぶ。
export { POST_end as POST } from "@/lib/capture/server/sessions-api";
export const dynamic = "force-dynamic";
