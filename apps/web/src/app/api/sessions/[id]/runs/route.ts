// POST /api/sessions/[id]/runs（W1）。RunResult を保存し run イベントを追記する。
export { POST_runs as POST } from "@/lib/capture/server/sessions-api";
export const dynamic = "force-dynamic";
