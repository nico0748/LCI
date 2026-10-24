import path from "node:path";

/** このパッケージのルート（packages/problem-tools） */
export const PKG_ROOT = path.resolve(import.meta.dirname, "..");
/** モノレポのルート */
export const REPO_ROOT = path.resolve(PKG_ROOT, "../..");

/** 問題バンクのルート。環境変数 LCI_PROBLEMS_ROOT で差し替え可能（apps/web と同じ規約） */
export function problemsRoot(): string {
  const env = process.env.LCI_PROBLEMS_ROOT;
  return env ? path.resolve(env) : path.join(REPO_ROOT, "problems");
}

/** targets.json / seeds.json の置き場所。先頭が `_` なので problem-loader の列挙からは除外される */
export function catalogDir(root: string = problemsRoot()): string {
  return path.join(root, "_catalog");
}
