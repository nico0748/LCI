/**
 * ブラウザでも読み込める純粋な部分だけの入口（@lci/core/browser と同じ方針）。
 * index.ts は store / runner / 音声合成経由で node:* に依存するため、クライアントからはこちらを import する。
 * compile（台本 → 時刻つきイベント）・humanize（打鍵化）・readings（読み）・checks（純粋な検証段）は node:* を使わない。
 */
export * from "./schema.ts";
export * from "./types.ts";
export * from "./text.ts";
export * from "./ops.ts";
export * from "./humanize.ts";
export * from "./readings.ts";
export * from "./compile.ts";
export * from "./checks.ts";
export { DEMO_GUIDE } from "./guide.ts";
