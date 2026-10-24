import path from "node:path";

/** リポジトリルート（apps/web から 2 つ上） */
export const REPO_ROOT = process.env.LCI_ROOT ?? path.resolve(process.cwd(), "../..");
export const PROBLEMS_ROOT = process.env.LCI_PROBLEMS_ROOT ?? path.join(REPO_ROOT, "problems");
export const DATA_ROOT = process.env.LCI_DATA_ROOT ?? path.join(REPO_ROOT, "data");
