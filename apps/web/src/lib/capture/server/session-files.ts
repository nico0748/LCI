import type { Language } from "@lci/core/browser";
import { DEFAULT_ENTRY, isRunnerLanguage } from "@lci/runner";

/**
 * セッション作成時に開くファイルを決める純粋関数（POST /api/sessions から使う。node --test で直接読めるよう "@/..." は使わない）。
 */

/** runner の対象外の言語の既定ファイル名（html は iframe、sql/markdown は実行しない） */
const NON_RUNNER_FILE = { javascript: "main.js", html: "index.html", sql: "query.sql", markdown: "notes.md" } as const;

/**
 * 言語の既定ファイル名。runner の 6 言語は runner の DEFAULT_ENTRY と同じ名前にする
 * （判定の entry 推定 pickEntry が既定名を優先するので、名前を揃えておけば必ずそのファイルが実行される）。
 */
export function defaultFileName(language: Language): string {
  return isRunnerLanguage(language) ? DEFAULT_ENTRY[language] : NON_RUNNER_FILE[language];
}

export interface InitialSessionFile {
  file_id: string;
  path: string;
  language: Language;
}

/**
 * 新しいセッションで開くファイル。選んだ言語の starter だけを starter_files の順に開き、
 * その言語の starter が無ければ言語既定の 1 ファイル（空）にする。
 *
 * 以前は全言語の starter を開いていた。Run の entry は先頭ファイル（InterviewScreen）、判定は runner の pickEntry
 * （複数ファイルなら既定名 → 拡張子 → 先頭）で決まるので、alg-0001 を C で始めると main.py が gcc に渡って CE になり、
 * 6 言語の starter を持つ CP 問題では Python で始めても main.c が実行されていた（05_cp_problems.md §0-5(a)、§8 T6）。
 */
export function initialSessionFiles(starters: readonly { path: string; language: Language }[], language: Language): InitialSessionFile[] {
  const mine = starters.filter((f) => f.language === language);
  const picked = mine.length > 0 ? mine : [{ path: defaultFileName(language), language }];
  return picked.map((f, i) => ({ file_id: `f${i + 1}`, path: f.path, language: f.language }));
}
