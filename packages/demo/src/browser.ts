/**
 * ブラウザでも読み込める純粋な部分だけの入口（@lci/core/browser と同じ方針）。
 * index.ts は store / runner / 音声合成経由で node:* に依存するため、クライアントからはこちらを import する。
 */
export * from "./schema.ts";
export * from "./types.ts";
