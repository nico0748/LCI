import { promises as fs } from "node:fs";
import path from "node:path";
import { toSummary, type Problem } from "@lci/core";
import { problems, problem } from "@/lib/server";
import { PROBLEMS_ROOT } from "@/lib/paths";

/**
 * 問題 API の読み取り系（W2）。
 * 問題文・制約は常に返すが、面接官メモ・振り返り解説・テストのシナリオ詳細は
 * `?reveal=1` のときだけ返す（04 §6.1: 初見性を守る。レビュー画面で初めて開示する）。
 */

export async function listProblemSummaries() {
  const ps = await problems();
  return ps.map(toSummary);
}

/** reveal=1 のとき追加で返す参照解の本文（相対パスを解決して読む） */
export type RevealedProblem = Problem & { reference_solution_texts?: Record<string, string> };

export async function getProblemForApi(id: string, reveal: boolean): Promise<RevealedProblem | null> {
  const p = await problem(id);
  if (!p) return null;
  if (reveal) {
    const texts: Record<string, string> = {};
    for (const [lang, rel] of Object.entries(p.meta.reference_solutions)) {
      // problem ディレクトリの外は読まない（パス走査対策）
      const abs = path.resolve(PROBLEMS_ROOT, p.dir, rel);
      if (!abs.startsWith(path.resolve(PROBLEMS_ROOT, p.dir) + path.sep)) continue;
      try {
        texts[lang] = await fs.readFile(abs, "utf8");
      } catch {
        /* 参照解ファイルが無い言語は省く */
      }
    }
    return { ...p, reference_solution_texts: texts };
  }
  return redactProblem(p);
}

/** 非公開部分を落とす。tests は kind と件数程度に留める */
export function redactProblem(p: Problem): Problem {
  const body = { ...p.body, interviewer_notes: "", review_notes: "" };
  let tests: Problem["tests"];
  switch (p.tests.kind) {
    case "stdio":
      tests = { ...p.tests, cases: p.tests.cases.filter((c) => c.visibility === "sample") };
      break;
    case "web":
      // シナリオの手順は隠す（名前だけ残すと内容が推測できるので全て落とす）
      tests = { ...p.tests, scenarios: [], layout: [], rubricHints: [] };
      break;
    case "unit":
      tests = { ...p.tests, harness: {} };
      break;
    default:
      tests = p.tests;
  }
  // rubric_hints と reference_solutions の中身も隠す
  const meta = { ...p.meta, rubric_hints: { red_flags: [], checklist: [] }, reference_solutions: {} };
  return { ...p, meta, body, tests };
}
