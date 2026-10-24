/**
 * 参照解セルフテスト（G2 の Docker 無し版）。
 *
 * 各問題の参照解を、ローカルの python3 / node / go / gcc / rustc / php で実際に動かし、
 * 自分の tests.json を通ることを確認する。さらに「候補者に渡す starter がテストを落とすこと」
 * （テストの有効性: 空実装や未修正のバグ入りコードが通ってしまわないこと）も検査する。
 *
 * - unit : 作業ディレクトリに参照解を userEntry[lang] の名前で、harness.files を basename でコピーし command を実行
 * - stdio: 各ケースの stdin を与えて実行し compare.mode で比較
 * - web  : ブラウザが無いのでスキップ（jsdom で回すのは scripts/web-selftest.ts。セレクタの整合は validate が静的に見る）
 * - none : スキップ
 *
 * 使い方: pnpm --filter @lci/problem-tools selftest [--only <id|prefix,...>] [--lang <lang>] [--keep] [--verbose] [--root <dir>]
 */
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Problem } from "@lci/core";
import { loadEntries } from "../src/gates.ts";
import { problemsRoot } from "../src/paths.ts";
import { renderTable } from "../src/report.ts";

interface Runner {
  /** コンパイルが必要な言語だけ */
  build?: (src: string, bin: string) => string[];
  run: (src: string, bin: string) => string[];
  /** 実行前に存在確認するコマンド */
  tool: string;
}

const RUNNERS: Record<string, Runner> = {
  python: { tool: "python3", run: (src) => ["python3", "-I", src] },
  typescript: { tool: "node", run: (src) => ["node", "--experimental-strip-types", src] },
  javascript: { tool: "node", run: (src) => ["node", src] },
  go: { tool: "go", build: (src, bin) => ["go", "build", "-o", bin, src], run: (_s, bin) => [bin] },
  c: { tool: "gcc", build: (src, bin) => ["gcc", "-O2", "-std=c11", "-o", bin, src, "-lm"], run: (_s, bin) => [bin] },
  rust: { tool: "rustc", build: (src, bin) => ["rustc", "-O", "-o", bin, src], run: (_s, bin) => [bin] },
  php: { tool: "php", run: (src) => ["php", src] },
};

const UNIT_TOOLS: Record<string, string> = { python: "python3", typescript: "node", javascript: "node", go: "go", rust: "rustc", c: "gcc", php: "php" };

interface Args {
  root: string;
  only: string | null;
  lang: string | null;
  keep: boolean;
  verbose: boolean;
}

/** --only は「alg-0003」のような完全一致、「alg-」のような接頭辞、カンマ区切りの複数指定を受け付ける */
function matchesOnly(id: string, only: string): boolean {
  return only.split(",").some((x) => x !== "" && (id === x || (x.endsWith("-") && id.startsWith(x))));
}

function parseArgs(argv: string[]): Args {
  const a: Args = { root: problemsRoot(), only: null, lang: null, keep: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]!;
    if (x === "--only") a.only = argv[++i] ?? null;
    else if (x === "--lang") a.lang = argv[++i] ?? null;
    else if (x === "--root") a.root = path.resolve(argv[++i] ?? a.root);
    else if (x === "--keep") a.keep = true;
    else if (x === "--verbose") a.verbose = true;
  }
  return a;
}

function hasTool(tool: string): boolean {
  const r = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
  return r.status === 0;
}

interface Exec {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function exec(cmd: string[], cwd: string, input?: string, timeoutMs = 30_000): Exec {
  const [bin, ...args] = cmd;
  const r = spawnSync(bin!, args, { cwd, input, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", timedOut: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT" };
}

function execShell(command: string, cwd: string, timeoutMs = 120_000): Exec {
  return exec(["sh", "-c", command], cwd, undefined, timeoutMs);
}

// ---- 出力比較（02 §FR-X-02-1: exact / token / float） -----------------------------

function compareOutput(mode: "exact" | "token" | "float", actual: string, expected: string, floatAbs = 1e-6, floatRel = 1e-6): { ok: boolean; why?: string } {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trimEnd();
  if (mode === "exact") {
    return norm(actual) === norm(expected) ? { ok: true } : { ok: false, why: `exact 不一致\n  期待: ${JSON.stringify(norm(expected).slice(0, 200))}\n  実際: ${JSON.stringify(norm(actual).slice(0, 200))}` };
  }
  const at = actual.split(/\s+/).filter(Boolean);
  const et = expected.split(/\s+/).filter(Boolean);
  if (at.length !== et.length) return { ok: false, why: `トークン数不一致 期待 ${et.length} / 実際 ${at.length}\n  期待先頭: ${et.slice(0, 12).join(" ")}\n  実際先頭: ${at.slice(0, 12).join(" ")}` };
  for (let i = 0; i < et.length; i++) {
    const a = at[i]!;
    const e = et[i]!;
    if (a === e) continue;
    if (mode === "float") {
      const fa = Number(a);
      const fe = Number(e);
      if (Number.isFinite(fa) && Number.isFinite(fe)) {
        const diff = Math.abs(fa - fe);
        if (diff <= floatAbs || diff <= floatRel * Math.abs(fe)) continue;
      }
    }
    return { ok: false, why: `トークン ${i} 不一致: 期待 "${e}" 実際 "${a}"` };
  }
  return { ok: true };
}

// ---- 結果 ------------------------------------------------------------------------

type Verdict = "PASS" | "FAIL" | "SKIP";
interface Row {
  id: string;
  kind: string;
  lang: string;
  solution: Verdict;
  /** starter がテストを落とすか: FAILS（期待通り）/ PASSES（テスト無効）/ n/a（starter 無し）/ -（未実施） */
  starter: "FAILS" | "PASSES" | "n/a" | "-";
  note: string;
  details: string[];
}

async function mkWork(base: string, label: string): Promise<string> {
  const d = await fs.mkdtemp(path.join(base, `${label}-`));
  return d;
}

async function copyTo(src: string, dstDir: string, name: string): Promise<string> {
  const dst = path.join(dstDir, name);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  return dst;
}

/** stdio: 1 つのソースを全ケースで走らせる。戻り値は失敗ケースの説明（空なら全通過） */
async function runStdioSource(p: Problem, dir: string, lang: string, sourcePath: string, work: string, verbose: boolean): Promise<{ failures: string[]; crashed: boolean }> {
  if (p.tests.kind !== "stdio") return { failures: ["not stdio"], crashed: false };
  const runner = RUNNERS[lang]!;
  const bin = path.join(work, "a.out");
  if (runner.build) {
    const b = exec(runner.build(sourcePath, bin), work, undefined, 120_000);
    if (b.status !== 0) return { failures: [`ビルド失敗:\n${(b.stderr || b.stdout).slice(0, 1500)}`], crashed: true };
  }
  const failures: string[] = [];
  let crashed = false;
  const { compare } = p.tests;
  for (const c of p.tests.cases) {
    const stdin = c.stdin ?? (c.stdinFile ? await fs.readFile(path.join(dir, c.stdinFile), "utf8") : "");
    const expected = c.expected ?? (c.expectedFile ? await fs.readFile(path.join(dir, c.expectedFile), "utf8") : "");
    const timeout = Math.max(5_000, (c.limits?.wallMs ?? p.tests.limits.wallMs ?? 0) * 3, 15_000);
    const r = exec(runner.run(sourcePath, bin), work, stdin, timeout);
    if (r.timedOut) {
      failures.push(`${c.name}: TLE（${timeout} ms）`);
      crashed = true;
      continue;
    }
    if (r.status !== 0) {
      failures.push(`${c.name}: RE exit=${r.status}\n${r.stderr.slice(0, 800)}`);
      crashed = true;
      continue;
    }
    const cmp = compareOutput(compare.mode, r.stdout, expected, compare.floatAbs, compare.floatRel);
    if (!cmp.ok) failures.push(`${c.name}: WA ${cmp.why}`);
    else if (verbose) console.log(`    ${p.meta.id} ${lang} ${c.name}: AC`);
  }
  return { failures, crashed };
}

/** unit: entry ファイルの中身を与えて harness を走らせる */
async function runUnitSource(p: Problem, dir: string, lang: string, entryContent: string, work: string): Promise<Exec> {
  if (p.tests.kind !== "unit") throw new Error("not unit");
  const h = p.tests.harness[lang]!;
  const entry = p.tests.userEntry[lang]!;
  await fs.writeFile(path.join(work, entry), entryContent, "utf8");
  for (const f of h.files) await copyTo(path.join(dir, f), work, path.basename(f));
  return execShell(h.command, work);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadEntries(args.root);
  const base = await fs.mkdtemp(path.join(process.env.LCI_SELFTEST_TMP ?? os.tmpdir(), "lci-selftest-"));
  const rows: Row[] = [];

  for (const e of entries) {
    if (!e.problem) {
      rows.push({ id: path.basename(e.dir), kind: "-", lang: "-", solution: "FAIL", starter: "-", note: "読み込み失敗（problems:validate 参照）", details: e.issues.map((i) => i.message) });
      continue;
    }
    const p = e.problem;
    if (args.only && !matchesOnly(p.meta.id, args.only)) continue;
    const dir = path.join(args.root, e.dir);
    const kind = p.tests.kind;
    if (kind === "web" || kind === "none") {
      rows.push({ id: p.meta.id, kind, lang: p.meta.languages.join(","), solution: "SKIP", starter: "-", note: kind === "web" ? "web-selftest（jsdom）で確認。本番判定は W1 のサンドボックス" : "設計スケッチ（テスト無し）", details: [] });
      continue;
    }
    for (const lang of p.meta.languages) {
      if (args.lang && lang !== args.lang) continue;
      const ref = p.meta.reference_solutions[lang];
      const row: Row = { id: p.meta.id, kind, lang, solution: "SKIP", starter: "-", note: "", details: [] };
      rows.push(row);
      if (!ref) {
        row.solution = "FAIL";
        row.note = "reference_solutions が無い";
        continue;
      }
      const tool = kind === "stdio" ? RUNNERS[lang]?.tool : UNIT_TOOLS[lang];
      if (!tool || (kind === "stdio" && !RUNNERS[lang])) {
        row.note = `言語 ${lang} のローカル実行は未対応`;
        continue;
      }
      if (!hasTool(tool)) {
        row.note = `${tool} が無いためスキップ`;
        continue;
      }
      const work = await mkWork(base, `${p.meta.id}-${lang}`);
      const refPath = path.join(dir, ref);
      if (kind === "stdio") {
        const src = await copyTo(refPath, work, `solution${path.extname(ref)}`);
        const r = await runStdioSource(p, dir, lang, src, work, args.verbose);
        row.solution = r.failures.length ? "FAIL" : "PASS";
        row.details.push(...r.failures);
        const starter = p.meta.starter_files.find((s) => s.language === lang && s.content !== undefined);
        if (starter) {
          const swork = await mkWork(base, `${p.meta.id}-${lang}-starter`);
          const spath = path.join(swork, `solution${path.extname(ref)}`);
          await fs.writeFile(spath, starter.content!, "utf8");
          const sr = await runStdioSource(p, dir, lang, spath, swork, false);
          row.starter = sr.failures.length ? "FAILS" : "PASSES";
          if (!sr.failures.length) row.details.push("starter が全ケース通過: テストが空実装を落とせていない");
        } else row.starter = "n/a";
        row.note = `${p.tests.cases.length} cases`;
      } else if (kind === "unit") {
        const entryName = p.tests.userEntry[lang];
        if (!entryName || !p.tests.harness[lang]) {
          row.solution = "FAIL";
          row.note = "harness/userEntry が無い";
          continue;
        }
        const r = await runUnitSource(p, dir, lang, await fs.readFile(refPath, "utf8"), work);
        row.solution = r.status === 0 && !r.timedOut ? "PASS" : "FAIL";
        if (row.solution === "FAIL") row.details.push(`参照解がテスト失敗 exit=${r.status}${r.timedOut ? " (timeout)" : ""}\n${(r.stdout + "\n" + r.stderr).trim().slice(-2500)}`);
        else if (args.verbose) console.log((r.stdout + r.stderr).trim().split("\n").slice(-6).join("\n"));
        const starter = p.meta.starter_files.find((s) => s.path === entryName && s.content !== undefined);
        if (starter) {
          const swork = await mkWork(base, `${p.meta.id}-${lang}-starter`);
          const sr = await runUnitSource(p, dir, lang, starter.content!, swork);
          row.starter = sr.status === 0 && !sr.timedOut ? "PASSES" : "FAILS";
          if (row.starter === "PASSES") row.details.push("starter がテストを全通過: テストが空実装／未修正コードを落とせていない");
        } else row.starter = "n/a";
        row.note = path.basename(p.tests.harness[lang]!.command.split(" ").at(-1) ?? "");
      }
    }
  }

  const table = renderTable(
    ["id", "kind", "lang", "参照解", "starter", "note"],
    rows.map((r) => [r.id, r.kind, r.lang, r.solution, r.starter, r.note]),
  );
  console.log(table);
  const bad = rows.filter((r) => r.solution === "FAIL" || r.starter === "PASSES");
  for (const r of bad) {
    console.log(`\n--- ${r.id} [${r.lang}] ---`);
    for (const d of r.details) console.log("  " + d.split("\n").join("\n  "));
  }
  const pass = rows.filter((r) => r.solution === "PASS").length;
  const skip = rows.filter((r) => r.solution === "SKIP").length;
  console.log(`\n参照解 PASS ${pass} / FAIL ${rows.filter((r) => r.solution === "FAIL").length} / SKIP ${skip}、starter が通ってしまう ${rows.filter((r) => r.starter === "PASSES").length}`);
  if (args.keep) console.log(`作業ディレクトリを残しました: ${base}`);
  else await fs.rm(base, { recursive: true, force: true });
  return bad.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    process.exit(1);
  },
);
