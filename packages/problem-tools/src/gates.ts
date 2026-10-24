import { promises as fs } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { extractTerms, listProblemDirs, loadProblemDir, type Category, type Problem } from "@lci/core";
import { titleSimilarity } from "./levenshtein.ts";

/**
 * Docker なしで実行できる品質ゲート（04 §4.3 の G1 / G1b / G3 / G5 ＋ 重複警告）。
 * G2（参照解の実行）は scripts/selftest.ts、G4（埋め込み類似度）・G6（相互レビュー）・G7（semgrep）は対象外。
 */

export type Level = "error" | "warn";
export interface Issue {
  level: Level;
  /** G1 / G1b / G3 / G5 / DUP / TESTS */
  gate: string;
  /** 問題 id。読み込めなかった場合はディレクトリ名 */
  problem: string;
  message: string;
}

export interface Entry {
  dir: string;
  problem: Problem | null;
  issues: Issue[];
}

export interface ValidationResult {
  root: string;
  entries: Entry[];
  errors: number;
  warnings: number;
}

export const TIME_LIMITS: readonly number[] = [15, 20, 30, 45];
export const STATEMENT_MIN = 80;
export const STATEMENT_MAX = 600;
export const TALKING_POINT_MIN_CHARS = 8;
export const TITLE_DUP_THRESHOLD = 0.85;

/** id の接頭辞（fe-0001 の fe）はカテゴリ ID の小文字 */
export function idPrefix(category: Category): string {
  return category.toLowerCase();
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function formatLoadError(e: unknown): string {
  if (e instanceof ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** 各問題ディレクトリを読み込み、スキーマ違反は G1 エラーにする */
export async function loadEntries(root: string): Promise<Entry[]> {
  const dirs = await listProblemDirs(root);
  const entries: Entry[] = [];
  for (const dir of dirs) {
    try {
      const problem = await loadProblemDir(root, dir);
      entries.push({ dir, problem, issues: [] });
    } catch (e) {
      entries.push({
        dir,
        problem: null,
        issues: [{ level: "error", gate: "G1", problem: path.basename(dir), message: `読み込み失敗: ${formatLoadError(e)}` }],
      });
    }
  }
  return entries;
}

type Push = (level: Level, gate: string, message: string) => void;

/** G1: ディレクトリ名・カテゴリ・id 形式・time_limit */
function gateG1(entry: Entry, push: Push): void {
  const p = entry.problem!;
  const m = p.meta;
  const base = path.basename(entry.dir);
  const catDir = path.dirname(entry.dir);
  if (base !== `${m.id}-${m.slug}`) push("error", "G1", `ディレクトリ名 ${base} が <id>-<slug>（${m.id}-${m.slug}）と一致しない`);
  if (catDir !== m.category) push("error", "G1", `カテゴリディレクトリ ${catDir} と frontmatter の category ${m.category} が一致しない`);
  if (!m.id.startsWith(`${idPrefix(m.category)}-`)) push("error", "G1", `id ${m.id} の接頭辞がカテゴリ ${m.category}（${idPrefix(m.category)}-）と一致しない`);
  if (!TIME_LIMITS.includes(m.time_limit)) push("error", "G1", `time_limit ${m.time_limit} は 15/20/30/45 のいずれかでなければならない`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug)) push("error", "G1", `slug ${m.slug} は小文字英数字とハイフンのみ`);
}

/** テストが「その言語をカバーしている」か（languages に列挙してよい条件） */
function testsCoverLanguage(p: Problem, lang: string): { ok: boolean; why?: string } {
  const t = p.tests;
  switch (t.kind) {
    case "stdio":
      return lang === "html" || lang === "sql" || lang === "markdown" ? { ok: false, why: "stdio 判定は html/sql/markdown には使えない" } : { ok: true };
    case "unit":
      if (!t.harness[lang]) return { ok: false, why: `tests.json の harness.${lang} が無い` };
      if (!t.userEntry[lang]) return { ok: false, why: `tests.json の userEntry.${lang} が無い` };
      return { ok: true };
    case "web":
      return lang === "html" ? { ok: true } : { ok: false, why: "web 判定でテストできるのは html のみ" };
    case "none":
      return lang === "markdown" ? { ok: true } : { ok: false, why: "tests.json が無い（kind none）問題で宣言できるのは markdown のみ" };
  }
}

/** G1b: languages ⊆ (参照解ファイルが存在 ∧ テストがその言語をカバー) */
async function gateG1b(root: string, entry: Entry, push: Push): Promise<void> {
  const p = entry.problem!;
  const dir = path.join(root, entry.dir);
  for (const lang of p.meta.languages) {
    const ref = p.meta.reference_solutions[lang];
    if (!ref) {
      push("error", "G1b", `languages に ${lang} があるが reference_solutions.${lang} が無い`);
    } else if (!(await exists(path.join(dir, ref)))) {
      push("error", "G1b", `reference_solutions.${lang} = ${ref} が存在しない`);
    } else {
      const st = await fs.stat(path.join(dir, ref));
      if (st.size === 0) push("error", "G1b", `reference_solutions.${lang} = ${ref} が空ファイル`);
    }
    const cov = testsCoverLanguage(p, lang);
    if (!cov.ok) push("error", "G1b", `languages に ${lang} があるがテストが対応していない: ${cov.why}`);
  }
  for (const lang of Object.keys(p.meta.reference_solutions)) {
    if (!p.meta.languages.includes(lang as never)) push("warn", "G1b", `reference_solutions.${lang} があるが languages に列挙されていない（意図的なら無視可）`);
  }
  if (p.tests.kind === "unit") {
    for (const lang of Object.keys(p.tests.harness)) {
      if (!p.meta.languages.includes(lang as never)) push("warn", "G1b", `harness.${lang} があるが languages に無い`);
    }
  }
}

/** G3: 問題文の長さ・talking_points / requirements の数・core の人手レビュー・非公開セクション */
function gateG3(entry: Entry, push: Push): void {
  const p = entry.problem!;
  const m = p.meta;
  const len = [...p.body.statement.trim()].length;
  if (len < STATEMENT_MIN) push("error", "G3", `問題文が短すぎる（${len} 字 < ${STATEMENT_MIN}）`);
  if (len > STATEMENT_MAX) push("error", "G3", `問題文が長すぎる（${len} 字 > ${STATEMENT_MAX}）。面接官が口頭で言える粒度に削る`);
  if (m.talking_points.length < 3) push("error", "G3", `talking_points が ${m.talking_points.length} 個（3 個以上必要）`);
  if (m.requirements.length < 2) push("error", "G3", `requirements が ${m.requirements.length} 個（2 個以上必要）`);
  if (m.tier === "core") {
    // エージェントが書いた問題は reviewed_by: llm。Nico がレビューしたら human に変える（それまでは警告で可視化）
    if (m.review.reviewed_by !== "human") push("warn", "G3", `tier=core だが人手レビュー未了（reviewed_by: ${m.review.reviewed_by}）`);
    if (!p.body.interviewer_notes.trim()) push("error", "G3", "tier=core は『面接官メモ（非公開）』が必須");
    if (!p.body.review_notes.trim()) push("error", "G3", "tier=core は『振り返り用解説（終了後のみ表示）』が必須");
    if (m.rubric_hints.red_flags.length === 0) push("warn", "G3", "tier=core なのに rubric_hints.red_flags が空");
  } else {
    if (!p.body.interviewer_notes.trim()) push("warn", "G3", "『面接官メモ（非公開）』が空");
    if (!p.body.review_notes.trim()) push("warn", "G3", "『振り返り用解説（終了後のみ表示）』が空");
  }
  if (!p.body.constraints.trim()) push("warn", "G3", "『制約』が空");
  const tpIds = new Set<string>();
  for (const tp of m.talking_points) {
    if (tpIds.has(tp.id)) push("error", "G3", `talking_points の id ${tp.id} が重複`);
    tpIds.add(tp.id);
  }
  const reqIds = new Set<string>();
  for (const r of m.requirements) {
    if (reqIds.has(r.id)) push("error", "G3", `requirements の id ${r.id} が重複`);
    reqIds.add(r.id);
  }
}

/** G5: talking_point の具体性。短すぎる・名詞相当の語（API 名/データ構造/制約値）を含まないものは一般論とみなす */
function gateG5(entry: Entry, push: Push): void {
  const p = entry.problem!;
  for (const tp of p.meta.talking_points) {
    const len = [...tp.text.trim()].length;
    if (len < TALKING_POINT_MIN_CHARS) push("error", "G5", `talking_point ${tp.id} が短すぎる（${len} 字）: "${tp.text}"`);
    const terms = extractTerms(tp.text);
    if (terms.length === 0) push("error", "G5", `talking_point ${tp.id} に検出可能な用語（英数字トークン/カタカナ/漢字語）が無い: "${tp.text}"`);
  }
}

/** TESTS: tests.json の中身とファイル実在。G2（実行）の前提条件 */
async function gateTests(root: string, entry: Entry, push: Push): Promise<void> {
  const p = entry.problem!;
  const dir = path.join(root, entry.dir);
  const t = p.tests;
  if (t.kind === "none" && p.meta.category !== "SYS") push("error", "TESTS", "tests.json が無い（kind none）のは SYS カテゴリのみ許容");
  if (t.kind === "none" && p.meta.category === "SYS" && p.meta.rubric_hints.checklist.length < 3) {
    push("error", "TESTS", "SYS は hidden_tests の代わりに rubric_hints.checklist（3 項目以上）が必要");
  }
  if (t.kind === "stdio") {
    let samples = 0;
    for (const c of t.cases) {
      if (c.visibility === "sample") samples++;
      if (c.stdin === undefined && !c.stdinFile) push("error", "TESTS", `case ${c.name}: stdin か stdinFile が必要`);
      if (c.expected === undefined && !c.expectedFile) push("error", "TESTS", `case ${c.name}: expected か expectedFile が必要`);
      for (const f of [c.stdinFile, c.expectedFile]) {
        if (f && !(await exists(path.join(dir, f)))) push("error", "TESTS", `case ${c.name}: ${f} が存在しない`);
      }
    }
    if (samples === 0) push("warn", "TESTS", "visibility: sample のケースが無い（候補者が Run で確認できるケースを 1 つは置く）");
    if (t.cases.length < 3) push("warn", "TESTS", `ケース数が ${t.cases.length}（隠しケース含め 3 以上を推奨）`);
  }
  if (t.kind === "unit") {
    for (const [lang, h] of Object.entries(t.harness)) {
      if (h.files.length === 0) push("error", "TESTS", `harness.${lang}.files が空`);
      for (const f of h.files) {
        if (!(await exists(path.join(dir, f)))) push("error", "TESTS", `harness.${lang}: ${f} が存在しない`);
      }
      const entryFile = t.userEntry[lang];
      if (!entryFile) {
        push("error", "TESTS", `userEntry.${lang} が無い`);
      } else if (!p.meta.starter_files.some((s) => s.path === entryFile)) {
        push("warn", "TESTS", `userEntry.${lang} = ${entryFile} に対応する starter_files が無い（候補者は空ファイルから始めることになる）`);
      }
      if (lang === "python" && /-m unittest(?!\s+discover)/.test(h.command) && /\s-I\b/.test(h.command)) {
        push("warn", "TESTS", `harness.${lang}.command: python3 -I では cwd が sys.path に入らないため "-m unittest <module>" は失敗する。"-m unittest discover -s . -p <file>" を使う`);
      }
    }
  }
  if (t.kind === "web") {
    if (t.scenarios.length === 0) push("error", "TESTS", "web 判定なのに scenarios が空");
    if (!t.mockApi) push("warn", "TESTS", "mockApi が無い（通信を伴わない問題なら無視可）");
    // シナリオが参照する #id セレクタが参照解に存在するかの静的チェック（ブラウザ無しでの最低限の自己整合性）
    const ref = p.meta.reference_solutions.html;
    if (ref && (await exists(path.join(dir, ref)))) {
      const html = await fs.readFile(path.join(dir, ref), "utf8");
      const ids = new Set<string>();
      for (const s of t.scenarios) {
        for (const step of s.steps) {
          const sel =
            "type" in step ? step.type : "click" in step ? step.click : "expectText" in step ? step.expectText.selector : "expectNoText" in step ? step.expectNoText.selector : null;
          if (sel) for (const m of sel.matchAll(/#([A-Za-z0-9_-]+)/g)) ids.add(m[1]!);
        }
      }
      for (const id of ids) {
        if (new RegExp(`id=["']${id}["']`).test(html)) continue;
        // like-1 のように「接頭辞 + 番号」で JS が生成する id は、接頭辞（"like-"）が参照解に書かれていれば存在するとみなす
        const dyn = /^(.*[-_])\d+$/.exec(id);
        if (dyn && html.includes(dyn[1]!)) continue;
        push("warn", "TESTS", `シナリオが参照する #${id} が参照解 ${ref} に見つからない（動的生成なら無視可）`);
      }
    }
  }
}

/** DUP: 正規化したタイトルの Levenshtein 類似度が閾値以上なら警告 */
function gateDuplicates(entries: Entry[]): void {
  const loaded = entries.filter((e) => e.problem);
  for (let i = 0; i < loaded.length; i++) {
    for (let j = i + 1; j < loaded.length; j++) {
      const a = loaded[i]!;
      const b = loaded[j]!;
      const sim = titleSimilarity(a.problem!.meta.title, b.problem!.meta.title);
      if (sim >= TITLE_DUP_THRESHOLD) {
        a.issues.push({
          level: "warn",
          gate: "DUP",
          problem: a.problem!.meta.id,
          message: `タイトルが ${b.problem!.meta.id}「${b.problem!.meta.title}」と近似重複（類似度 ${sim.toFixed(2)}）`,
        });
      }
    }
  }
}

export async function validateProblems(root: string): Promise<ValidationResult> {
  const entries = await loadEntries(root);
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.problem) continue;
    const id = entry.problem.meta.id;
    const push: Push = (level, gate, message) => entry.issues.push({ level, gate, problem: id, message });
    const prev = seen.get(id);
    if (prev) push("error", "G1", `id ${id} が ${prev} と重複`);
    else seen.set(id, entry.dir);
    gateG1(entry, push);
    await gateG1b(root, entry, push);
    gateG3(entry, push);
    gateG5(entry, push);
    await gateTests(root, entry, push);
  }
  gateDuplicates(entries);
  let errors = 0;
  let warnings = 0;
  for (const e of entries) for (const i of e.issues) (i.level === "error" ? errors++ : warnings++);
  return { root, entries, errors, warnings };
}
