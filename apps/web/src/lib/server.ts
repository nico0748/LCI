import { SessionStore, loadAllProblems, findProblem, type Problem } from "@lci/core";
import { DATA_ROOT, PROBLEMS_ROOT } from "./paths";

/** Next.js の dev サーバはモジュールを再評価することがあるので globalThis に保持する */
const g = globalThis as unknown as { __lciStore?: SessionStore; __lciProblems?: Promise<Problem[]> };

export function store(): SessionStore {
  g.__lciStore ??= new SessionStore(DATA_ROOT);
  return g.__lciStore;
}

export async function problems(force = false): Promise<Problem[]> {
  if (force || !g.__lciProblems) g.__lciProblems = loadAllProblems(PROBLEMS_ROOT);
  return g.__lciProblems;
}

export async function problem(id: string): Promise<Problem | undefined> {
  return findProblem(await problems(), id);
}
