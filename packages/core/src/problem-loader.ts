import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Problem, ProblemBody, ProblemMeta, ProblemSummary, ProblemTests, type Category } from "./problem.ts";

/** frontmatter と本文を分離 */
export function splitFrontmatter(src: string): { yaml: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error("problem.md に YAML frontmatter がありません");
  return { yaml: m[1] ?? "", body: m[2] ?? "" };
}

const SECTION_MAP: Record<string, keyof ProblemBody> = {
  問題文: "statement",
  制約: "constraints",
  "面接官メモ（非公開）": "interviewer_notes",
  面接官メモ: "interviewer_notes",
  "振り返り用解説（終了後のみ表示）": "review_notes",
  振り返り用解説: "review_notes",
};

/** `## 見出し` ごとに本文を分割する */
export function parseBody(body: string): ProblemBody {
  const out: Record<string, string> = { statement: "", constraints: "", interviewer_notes: "", review_notes: "" };
  let current: keyof ProblemBody | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (current) out[current] = buf.join("\n").trim();
    buf.length = 0;
  };
  for (const line of body.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      const key = SECTION_MAP[(h[1] ?? "").trim()];
      current = key ?? null;
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return ProblemBody.parse(out);
}

export async function loadProblemDir(problemsRoot: string, relDir: string): Promise<Problem> {
  const dir = path.join(problemsRoot, relDir);
  const md = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  const { yaml, body } = splitFrontmatter(md);
  const meta = ProblemMeta.parse(YAML.parse(yaml));
  let tests: ProblemTests = { kind: "none" };
  try {
    const raw = await fs.readFile(path.join(dir, "tests.json"), "utf8");
    tests = ProblemTests.parse(JSON.parse(raw));
  } catch (e: unknown) {
    if (!(e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ENOENT")) throw e;
  }
  // starter_files の content_ref を解決
  for (const f of meta.starter_files) {
    if (f.content_ref && f.content === undefined) {
      f.content = await fs.readFile(path.join(dir, f.content_ref), "utf8");
    }
  }
  return Problem.parse({ meta, body: parseBody(body), tests, dir: relDir });
}

export async function listProblemDirs(problemsRoot: string): Promise<string[]> {
  const out: string[] = [];
  let cats: string[] = [];
  try {
    cats = await fs.readdir(problemsRoot);
  } catch {
    return out;
  }
  for (const cat of cats) {
    const catDir = path.join(problemsRoot, cat);
    const st = await fs.stat(catDir).catch(() => null);
    if (!st?.isDirectory() || cat.startsWith(".") || cat.startsWith("_")) continue;
    for (const d of await fs.readdir(catDir)) {
      const pd = path.join(catDir, d);
      const s = await fs.stat(pd).catch(() => null);
      if (!s?.isDirectory()) continue;
      try {
        await fs.access(path.join(pd, "problem.md"));
        out.push(path.join(cat, d));
      } catch {
        /* skip */
      }
    }
  }
  return out.sort();
}

export async function loadAllProblems(problemsRoot: string): Promise<Problem[]> {
  const dirs = await listProblemDirs(problemsRoot);
  const ps: Problem[] = [];
  for (const d of dirs) ps.push(await loadProblemDir(problemsRoot, d));
  return ps;
}

export function toSummary(p: Problem): ProblemSummary {
  const { id, slug, title, category, tier, difficulty, time_limit, languages, tags } = p.meta;
  return ProblemSummary.parse({ id, slug, title, category, tier, difficulty, time_limit, languages, tags, dir: p.dir, kind: p.tests.kind });
}

export function findProblem(ps: Problem[], id: string): Problem | undefined {
  return ps.find((p) => p.meta.id === id);
}

export function countByCategory(ps: Problem[]): Record<Category, number> {
  const out = { FE: 0, BE: 0, DATA: 0, ALG: 0, CP: 0, SQL: 0, SEC: 0, DBG: 0, SYS: 0, LOW: 0 } as Record<Category, number>;
  for (const p of ps) out[p.meta.category]++;
  return out;
}
