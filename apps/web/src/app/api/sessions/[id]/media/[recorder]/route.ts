// GET /api/sessions/[id]/media/[recorder]（W2, Range 対応）。PUT は W1 が追加する。
export { GET_media as GET, GET_media as HEAD } from "@/lib/review/sessions-api";
export const dynamic = "force-dynamic";
// PUT /api/sessions/[id]/media/[recorder]（W1）。生バイナリチャンクを .webm.part に追記する。
export { PUT_media as PUT } from "@/lib/capture/server/sessions-api";
