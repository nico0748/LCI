import { promises as fs } from "node:fs";
import path from "node:path";
import { listProblemDirs, loadProblemDir, type Language, type Problem } from "@lci/core";
import { DEFAULT_ENTRY, isRunnerLanguage } from "@lci/runner";

/**
 * デモ作成に使う問題の読み込み（node 専用）。
 * 問題バンクは並行して増えるので、壊れた（書きかけの）problem.md が 1 つあっても全体を落とさない。
 */

export const PROBLEM_ID_RE = /^[a-z]+-\d{4}$/;

/** 1 問読む。ディレクトリ名が `<id>-slug` のものを優先し、無ければ全件を（壊れたものを飛ばして）探す */
export async function findProblemById(problemsRoot: string, id: string): Promise<Problem | null> {
  if (!PROBLEM_ID_RE.test(id)) return null;
  const dirs = await listProblemDirs(problemsRoot);
  const likely = dirs.filter((d) => {
    const base = path.basename(d);
    return base === id || base.startsWith(`${id}-`);
  });
  for (const d of [...likely, ...dirs.filter((x) => !likely.includes(x))]) {
    try {
      const p = await loadProblemDir(problemsRoot, d);
      if (p.meta.id === id) return p;
    } catch {
      /* 書きかけ・壊れた問題は飛ばす */
    }
  }
  return null;
}

/** 全問（壊れたものは飛ばす） */
export async function loadProblemsLenient(problemsRoot: string): Promise<Problem[]> {
  const out: Problem[] = [];
  for (const d of await listProblemDirs(problemsRoot)) {
    try {
      out.push(await loadProblemDir(problemsRoot, d));
    } catch {
      /* skip */
    }
  }
  return out;
}

/** D7: MVP は stdio / unit だけ */
export function demoSupported(p: Problem): boolean {
  return p.tests.kind === "stdio" || p.tests.kind === "unit";
}

export function unsupportedReason(p: Problem): string | null {
  if (p.tests.kind === "web") return `${p.meta.id} は web 問題（ブラウザ内で判定する問題）です。web 問題のデモは v1.1 で対応予定で、今は stdio / unit 問題だけ作れます（00_decisions D7）`;
  if (p.tests.kind === "none") return `${p.meta.id} には自動テストが無い（kind=none）ため、デモの検証ができません。stdio / unit 問題を選んでください`;
  return null;
}

/** デモで編集する 1 ファイル（F15）: その言語の starter、無ければ unit の userEntry、無ければ既定名 */
export function demoFileFor(p: Problem, language: Language): { path: string; base: "starter" | "empty"; content: string } {
  const starter = p.meta.starter_files.find((f) => f.language === language);
  if (starter) return { path: starter.path, base: "starter", content: (starter.content ?? "").replace(/\r\n?/g, "\n") };
  const userEntry = p.tests.kind === "unit" ? p.tests.userEntry[language] : undefined;
  const fallback = isRunnerLanguage(language) ? DEFAULT_ENTRY[language] : `main.${language}`;
  return { path: userEntry ?? fallback, base: "empty", content: "" };
}

/** 参照解（生テキスト）。problem ディレクトリの外は読まない */
export async function readReferenceSolutions(problemsRoot: string, p: Problem): Promise<Record<string, string>> {
  const root = path.resolve(problemsRoot, p.dir);
  const out: Record<string, string> = {};
  for (const [lang, rel] of Object.entries(p.meta.reference_solutions)) {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) continue;
    try {
      out[lang] = (await fs.readFile(abs, "utf8")).replace(/\r\n?/g, "\n");
    } catch {
      /* 無い言語は飛ばす */
    }
  }
  return out;
}

/** サンプルケースの入出力（stdio のみ） */
export async function sampleCases(problemsRoot: string, p: Problem): Promise<{ name: string; stdin: string; expected: string }[]> {
  if (p.tests.kind !== "stdio") return [];
  const root = path.resolve(problemsRoot, p.dir);
  const read = async (rel?: string) => {
    if (!rel) return "";
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) return "";
    return fs.readFile(abs, "utf8").catch(() => "");
  };
  const out = [];
  for (const c of p.tests.cases.filter((x) => x.visibility === "sample")) {
    out.push({ name: c.name, stdin: c.stdin ?? (await read(c.stdinFile)), expected: c.expected ?? (await read(c.expectedFile)) });
  }
  return out;
}

/** red_flags に振る id（covers で参照できるように rf1, rf2, …） */
export function redFlagIds(p: Problem): { id: string; text: string }[] {
  return p.meta.rubric_hints.red_flags.map((text, i) => ({ id: `rf${i + 1}`, text }));
}
