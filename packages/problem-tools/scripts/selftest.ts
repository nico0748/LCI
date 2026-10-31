/**
 * 参照解セルフテスト（G2 の Docker 無し版）。
 *
 * 各問題の参照解を、ローカルの python3 / node / go / gcc / rustc / php で実際に動かし、
 * 自分の tests.json を通ることを確認する。さらに「候補者に渡す starter がテストを落とすこと」
 * （テストの有効性: 空実装や未修正のバグ入りコードが通ってしまわないこと）も検査する。
 *
 * - unit : 作業ディレクトリに参照解を userEntry[lang] の名前で、harness.files を basename でコピーし command を実行
 * - stdio: 各ケースの stdin を与えて実行し compare.mode で比較。ケースごとに時間を計る
 * - web  : ブラウザが無いのでスキップ（jsdom で回すのは scripts/web-selftest.ts。セレクタの整合は validate が静的に見る）
 * - none : スキップ
 *
 * stdio の実行は runner と同じにする（05_cp_problems.md §8 T4）:
 * - コンパイル・実行の argv は @lci/runner の compileCommand / runCommand（judge モード）をそのまま使う
 *   （C は -std=c17 -Wall、Rust は --edition 2021、Python は -u なし、TS は --max-old-space-size、PHP は php -l で構文検査）
 * - 時間制限は runner と同じく「timeMs × 言語係数（Python/PHP ×3、TS ×2）」。比較も runner の compareOutput
 * - ulimit -v（memoryMb の 2 倍）と出力上限（outputKb）も runner の Docker 実行に合わせる
 *
 * 時間の判定（参照解）: どれかのケースが制限（timeMs × 係数）を超えたら FAIL、50% を超えたら警告。
 * 本番の判定は制限の 1.5 倍で TLE にするが、参照解は Mac の Docker 上の揺れに備えて余裕を持たせる（05 §4.3）。
 * `--timing` を付けると 50% 超も FAIL にする（CP の完了条件）。
 *
 * `--naive`: 問題ディレクトリの gen/naive.{py,c,rs,go,ts,php} を素朴解として走らせ、hidden-max-* のどれか 1 件以上で
 * 判定の TLE 閾値（制限 × 1.5）を超えることを要求する（TLE の罠が本当に素朴解を落とせるかの検査。05 §4.3）。
 * sample では正しい出力を出すこと（素朴解として正しいこと）も確かめる。
 *
 * 使い方: pnpm problems:selftest [--only <id|prefix,...>] [--lang <lang>] [--naive] [--timing] [--keep] [--verbose] [--root <dir>]
 *   --only  カンマ区切り。各要素は id（cp-0003）、接頭辞（cp- / cp-00 / alg）、問題ディレクトリ名（cp-0003-bookshelf-min-width）のどれでもよい
 */
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Problem } from "@lci/core";
import {
  DEFAULT_ENTRY,
  DEFAULT_LIMITS,
  TIME_MULTIPLIER,
  compareOutput,
  compileCommand,
  isRunnerLanguage,
  renderRustcStderr,
  runCommand,
  usesVirtualMemLimit,
  type RunnerLanguage,
} from "@lci/runner";
import { loadEntries } from "../src/gates.ts";
import { problemsRoot } from "../src/paths.ts";
import { renderTable } from "../src/report.ts";
import { matchesOnly, splitOnly } from "../src/select.ts";

/** 言語ごとに存在確認するコマンド */
const TOOL: Record<string, string> = { python: "python3", typescript: "node", javascript: "node", go: "go", c: "gcc", rust: "rustc", php: "php" };

/** gen/naive.* の拡張子 → 言語 */
const NAIVE_EXT: Record<string, RunnerLanguage> = { ".py": "python", ".c": "c", ".rs": "rust", ".go": "go", ".ts": "typescript", ".php": "php" };

/** 参照解がこの割合を超えたら警告（--timing なら FAIL）。05 §4.3 */
const WARN_RATIO = 0.5;
/** runner の classifyExec と同じ: 制限の 1.5 倍を超えたら TLE */
const JUDGE_TLE_FACTOR = 1.5;

interface Args {
  root: string;
  only: string[];
  lang: string | null;
  naive: boolean;
  timing: boolean;
  keep: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { root: problemsRoot(), only: [], lang: null, naive: false, timing: false, keep: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]!;
    // --only は複数回指定してもよい（シェルのブレース展開を空白区切りで渡すのにも対応するため、続く非フラグ引数も取り込む）
    if (x === "--only") {
      while (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) a.only.push(argv[++i]!);
    } else if (x === "--") continue;
    else if (x === "--lang") a.lang = argv[++i] ?? null;
    else if (x === "--root") a.root = path.resolve(argv[++i] ?? a.root);
    else if (x === "--naive") a.naive = true;
    else if (x === "--timing") a.timing = true;
    else if (x === "--keep") a.keep = true;
    else if (x === "--verbose") a.verbose = true;
    else {
      console.error(`未知の引数: ${x}`);
      process.exit(2);
    }
  }
  a.only = splitOnly(a.only);
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
  /** 壁時計（ms）。runner も壁時計で測るので揃える */
  ms: number;
  /** stdout + stderr のバイト数 */
  outBytes: number;
}

function exec(cmd: string[], cwd: string, input?: string, timeoutMs = 30_000, maxBufferBytes = 16 * 1024 * 1024): Exec {
  const [bin, ...args] = cmd;
  const t0 = performance.now();
  const r = spawnSync(bin!, args, { cwd, input, encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: maxBufferBytes, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  const ms = Math.round(performance.now() - t0);
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  return { status: r.status, stdout, stderr, timedOut: code === "ETIMEDOUT", ms, outBytes: Buffer.byteLength(stdout) + Buffer.byteLength(stderr) };
}

function execShell(command: string, cwd: string, timeoutMs = 120_000): Exec {
  return exec(["sh", "-c", command], cwd, undefined, timeoutMs);
}

/** Docker の run.sh と同じく ulimit -v（memoryMb の 2 倍。仮想メモリなので RSS より大きく取る）を掛けて実行する */
function withMemLimit(lang: RunnerLanguage, cmd: string[], memoryMb: number): string[] {
  if (!usesVirtualMemLimit(lang) || process.platform !== "linux") return cmd;
  return ["sh", "-c", `ulimit -v ${memoryMb * 1024 * 2} 2>/dev/null; exec "$@"`, "sh", ...cmd];
}

// ---- 制限（runner の mergeLimits と同じ規則） ------------------------------------

type StdioTests = Extract<Problem["tests"], { kind: "stdio" }>;
type StdioCase = StdioTests["cases"][number];

interface CaseLimits {
  /** timeMs × 言語係数。参照解はこれを超えたら FAIL */
  limitMs: number;
  /** 打ち切り（壁時計）。runner と同じく wallMs × 係数、ただし limitMs 以上 */
  wallMs: number;
  memoryMb: number;
  outputKb: number;
}

function caseLimits(tests: StdioTests, c: StdioCase, lang: RunnerLanguage): CaseLimits {
  const k = TIME_MULTIPLIER[lang];
  const timeMs = c.limits?.timeMs ?? tests.limits.timeMs ?? DEFAULT_LIMITS.timeMs;
  const wallMs = c.limits?.wallMs ?? tests.limits.wallMs ?? DEFAULT_LIMITS.wallMs;
  const limitMs = Math.round(timeMs * k);
  return {
    limitMs,
    wallMs: Math.max(Math.round(wallMs * k), limitMs),
    memoryMb: c.limits?.memoryMb ?? tests.limits.memoryMb ?? DEFAULT_LIMITS.memoryMb,
    outputKb: c.limits?.outputKb ?? tests.limits.outputKb ?? DEFAULT_LIMITS.outputKb,
  };
}

// ---- 結果 ------------------------------------------------------------------------

type Verdict = "PASS" | "FAIL" | "SKIP";
interface Timing {
  ms: number;
  limitMs: number;
  caseName: string;
}
interface Row {
  id: string;
  kind: string;
  lang: string;
  solution: Verdict;
  /** starter がテストを落とすか: FAILS（期待通り）/ PASSES（テスト無効）/ n/a（starter 無し）/ -（未実施） */
  starter: "FAILS" | "PASSES" | "n/a" | "-";
  /** 制限に対する比が最大のケース（stdio のみ） */
  worst: Timing | null;
  note: string;
  details: string[];
  warnings: string[];
}

interface NaiveRow {
  id: string;
  file: string;
  lang: string;
  /** TLE: 期待どおり hidden-max で落ちた / PASSES: 全 hidden-max で閾値内に終わった（罠が効いていない） / FAIL: 検査できない */
  verdict: "TLE" | "PASSES" | "FAIL" | "SKIP";
  worst: Timing | null;
  /** 判定の TLE 閾値（制限 × 1.5） */
  thresholdMs: number | null;
  note: string;
  details: string[];
}

async function mkWork(base: string, label: string): Promise<string> {
  return fs.mkdtemp(path.join(base, `${label}-`));
}

async function copyTo(src: string, dstDir: string, name: string): Promise<string> {
  const dst = path.join(dstDir, name);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  return dst;
}

async function readCase(dir: string, c: StdioCase): Promise<{ stdin: string; expected: string }> {
  const stdin = c.stdin ?? (c.stdinFile ? await fs.readFile(path.join(dir, c.stdinFile), "utf8") : "");
  const expected = c.expected ?? (c.expectedFile ? await fs.readFile(path.join(dir, c.expectedFile), "utf8") : "");
  return { stdin, expected };
}

/** runner と同じ compileCommand で作業ディレクトリ内の entry をビルドする。失敗なら説明を返す */
function build(lang: RunnerLanguage, entry: string, work: string): string | null {
  const cmd = compileCommand(lang, entry);
  if (!cmd) return null;
  // runner のコンパイル上限は 10 秒だが、ローカルの初回ビルド（go のキャッシュ作成など）は遅いので長めに待つ
  const b = exec(cmd, work, undefined, 120_000);
  if (b.status === 0 && !b.timedOut) return null;
  const err = lang === "rust" ? renderRustcStderr(b.stderr) : b.stderr || b.stdout;
  return `ビルド失敗（${cmd.join(" ")}）${b.timedOut ? " タイムアウト" : ""}:\n${err.slice(0, 1500)}`;
}

interface CaseRun {
  name: string;
  verdict: "AC" | "WA" | "TLE" | "RE" | "OLE";
  ms: number;
  lim: CaseLimits;
  message?: string;
}

/** stdio: 1 つのソース（作業ディレクトリに DEFAULT_ENTRY の名前で置いたもの）を、指定したケースで走らせる */
async function runStdioCases(
  p: Problem,
  dir: string,
  lang: RunnerLanguage,
  work: string,
  cases: readonly StdioCase[],
  opts: { killAt?: (lim: CaseLimits) => number; stopAfter?: (run: CaseRun) => boolean; verbose?: boolean } = {},
): Promise<{ buildError: string | null; runs: CaseRun[] }> {
  if (p.tests.kind !== "stdio") return { buildError: "not stdio", runs: [] };
  const tests = p.tests;
  const entry = DEFAULT_ENTRY[lang];
  const buildError = build(lang, entry, work);
  if (buildError) return { buildError, runs: [] };
  const runs: CaseRun[] = [];
  for (const c of cases) {
    const { stdin, expected } = await readCase(dir, c);
    const lim = caseLimits(tests, c, lang);
    const killAt = opts.killAt ? opts.killAt(lim) : lim.wallMs;
    const capBytes = lim.outputKb * 1024;
    const r = exec(withMemLimit(lang, runCommand(lang, entry, lim.memoryMb, "judge"), lim.memoryMb), work, stdin, killAt, Math.max(16 * 1024 * 1024, capBytes * 2));
    let run: CaseRun;
    if (r.timedOut) run = { name: c.name, verdict: "TLE", ms: r.ms, lim, message: `${killAt} ms で打ち切り` };
    else if (r.outBytes > capBytes) run = { name: c.name, verdict: "OLE", ms: r.ms, lim, message: `出力 ${Math.ceil(r.outBytes / 1024)} KiB > outputKb ${lim.outputKb}` };
    else if (r.status !== 0) run = { name: c.name, verdict: "RE", ms: r.ms, lim, message: `exit=${r.status}\n${r.stderr.slice(0, 800)}` };
    else {
      const cmp = compareOutput(r.stdout, expected, tests.compare);
      run = cmp.ok ? { name: c.name, verdict: "AC", ms: r.ms, lim } : { name: c.name, verdict: "WA", ms: r.ms, lim, message: cmp.message };
    }
    if (opts.verbose) console.log(`    ${p.meta.id} ${lang} ${c.name}: ${run.verdict} ${run.ms} ms / ${lim.limitMs} ms`);
    runs.push(run);
    if (opts.stopAfter?.(run)) break;
  }
  return { buildError: null, runs };
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

function worstOf(runs: readonly CaseRun[]): Timing | null {
  let w: Timing | null = null;
  for (const r of runs) if (!w || r.ms / r.lim.limitMs > w.ms / w.limitMs) w = { ms: r.ms, limitMs: r.lim.limitMs, caseName: r.name };
  return w;
}

function pct(t: Timing): string {
  return `${Math.round((t.ms / t.limitMs) * 100)}%`;
}

/** stdio の参照解 1 言語分 */
async function checkStdio(p: Problem, dir: string, lang: RunnerLanguage, refPath: string, base: string, args: Args, row: Row): Promise<void> {
  if (p.tests.kind !== "stdio") return;
  const work = await mkWork(base, `${p.meta.id}-${lang}`);
  await copyTo(refPath, work, DEFAULT_ENTRY[lang]);
  const r = await runStdioCases(p, dir, lang, work, p.tests.cases, { verbose: args.verbose });
  if (r.buildError) {
    row.solution = "FAIL";
    row.details.push(r.buildError);
  } else {
    for (const c of r.runs) {
      if (c.verdict !== "AC") row.details.push(`${c.name}: ${c.verdict}${c.message ? ` ${c.message}` : ""}`);
      else if (c.ms > c.lim.limitMs) row.details.push(`${c.name}: 時間超過 ${c.ms} ms > 制限 ${c.lim.limitMs} ms（timeMs × ${TIME_MULTIPLIER[lang]}）`);
      else if (c.ms > c.lim.limitMs * WARN_RATIO) {
        const msg = `${c.name}: ${c.ms} ms は制限 ${c.lim.limitMs} ms の ${Math.round((c.ms / c.lim.limitMs) * 100)}%（50% 以下が目安）`;
        if (args.timing) row.details.push(msg);
        else row.warnings.push(msg);
      }
    }
    row.solution = row.details.length ? "FAIL" : "PASS";
    row.worst = worstOf(r.runs);
  }
  const starter = p.meta.starter_files.find((s) => s.language === lang && s.content !== undefined);
  if (starter) {
    const swork = await mkWork(base, `${p.meta.id}-${lang}-starter`);
    await fs.writeFile(path.join(swork, DEFAULT_ENTRY[lang]), starter.content!, "utf8");
    const sr = await runStdioCases(p, dir, lang, swork, p.tests.cases);
    const passes = !sr.buildError && sr.runs.every((c) => c.verdict === "AC");
    row.starter = passes ? "PASSES" : "FAILS";
    if (passes) row.details.push("starter が全ケース通過: テストが空実装を落とせていない");
  } else row.starter = "n/a";
  row.note = `${p.tests.cases.length} cases`;
}

/** --naive: gen/naive.* を hidden-max-* で走らせ、少なくとも 1 件で判定の TLE 閾値を超えることを確かめる */
async function checkNaive(p: Problem, dir: string, base: string, args: Args): Promise<NaiveRow[]> {
  if (p.tests.kind !== "stdio") return [];
  const genDir = path.join(dir, "gen");
  const files = (await fs.readdir(genDir).catch(() => [] as string[])).filter((f) => /^naive\.[a-z]+$/.test(f)).sort();
  const out: NaiveRow[] = [];
  for (const f of files) {
    const lang = NAIVE_EXT[path.extname(f)];
    const row: NaiveRow = { id: p.meta.id, file: `gen/${f}`, lang: lang ?? "?", verdict: "FAIL", worst: null, thresholdMs: null, note: "", details: [] };
    out.push(row);
    if (!lang) {
      row.note = `拡張子 ${path.extname(f)} は未対応（.py/.c/.rs/.go/.ts/.php）`;
      continue;
    }
    if (args.lang && lang !== args.lang) {
      row.verdict = "SKIP";
      row.note = "--lang で除外";
      continue;
    }
    if (!hasTool(TOOL[lang]!)) {
      row.verdict = "SKIP";
      row.note = `${TOOL[lang]} が無いためスキップ`;
      continue;
    }
    const maxCases = p.tests.cases.filter((c) => c.visibility === "hidden" && c.name.startsWith("hidden-max"));
    if (maxCases.length === 0) {
      row.note = "hidden-max-* のケースが無い";
      continue;
    }
    const samples = p.tests.cases.filter((c) => c.visibility === "sample");
    const work = await mkWork(base, `${p.meta.id}-naive-${lang}`);
    await copyTo(path.join(genDir, f), work, DEFAULT_ENTRY[lang]);
    const tle = (lim: CaseLimits) => Math.ceil(lim.limitMs * JUDGE_TLE_FACTOR);
    // 閾値を少し過ぎたら打ち切り、1 件 TLE したら残りの hidden-max は走らせない（要件は「1 件以上」。待ち時間を最小にする）
    const isSlow = (m: CaseRun) => m.verdict === "TLE" || m.ms > tle(m.lim);
    const sampleNames = new Set(samples.map((c) => c.name));
    const r = await runStdioCases(p, dir, lang, work, [...samples, ...maxCases], {
      killAt: (lim) => tle(lim) + 250,
      stopAfter: (m) => !sampleNames.has(m.name) && isSlow(m),
      verbose: args.verbose,
    });
    if (r.buildError) {
      row.note = "ビルド失敗";
      row.details.push(r.buildError);
      continue;
    }
    const sampleRuns = r.runs.slice(0, samples.length);
    const maxRuns = r.runs.slice(samples.length);
    for (const s of sampleRuns) if (s.verdict !== "AC") row.details.push(`${s.name}: ${s.verdict}（素朴解は遅いだけで正しい出力を出すはず）${s.message ? ` ${s.message}` : ""}`);
    const slow = maxRuns.filter(isSlow);
    row.worst = worstOf(maxRuns);
    row.thresholdMs = maxRuns[0] ? tle(maxRuns[0].lim) : null;
    if (slow.length > 0) {
      row.verdict = row.details.length ? "FAIL" : "TLE";
      const skipped = maxCases.length - maxRuns.length;
      row.note = `${slow[0]!.name} で TLE${skipped ? `（残り ${skipped} 件は省略）` : ""}`;
    } else {
      row.verdict = "PASSES";
      row.note = `全 ${maxRuns.length} 件の hidden-max が閾値内に終わった`;
      row.details.push(`hidden-max-* のどれも ${row.thresholdMs} ms（制限 × ${JUDGE_TLE_FACTOR}）を超えない: 最大ケースを素朴解に最悪の形にするか N を上げる`);
      for (const m of maxRuns) row.details.push(`  ${m.name}: ${m.verdict} ${m.ms} ms`);
    }
  }
  return out;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadEntries(args.root);
  const base = await fs.mkdtemp(path.join(process.env.LCI_SELFTEST_TMP ?? os.tmpdir(), "lci-selftest-"));
  const rows: Row[] = [];
  const naiveRows: NaiveRow[] = [];
  const noNaive: string[] = [];
  let matched = 0;

  for (const e of entries) {
    if (!e.problem) {
      if (args.only.length && !matchesOnly(path.basename(e.dir), args.only)) continue;
      rows.push({ id: path.basename(e.dir), kind: "-", lang: "-", solution: "FAIL", starter: "-", worst: null, note: "読み込み失敗（problems:validate 参照）", details: e.issues.map((i) => i.message), warnings: [] });
      continue;
    }
    const p = e.problem;
    if (args.only.length && !matchesOnly(p.meta.id, args.only)) continue;
    matched++;
    const dir = path.join(args.root, e.dir);
    const kind = p.tests.kind;
    if (kind === "web" || kind === "none") {
      rows.push({ id: p.meta.id, kind, lang: p.meta.languages.join(","), solution: "SKIP", starter: "-", worst: null, note: kind === "web" ? "web-selftest（jsdom）で確認。本番判定は W1 のサンドボックス" : "設計スケッチ（テスト無し）", details: [], warnings: [] });
      continue;
    }
    for (const lang of p.meta.languages) {
      if (args.lang && lang !== args.lang) continue;
      const ref = p.meta.reference_solutions[lang];
      const row: Row = { id: p.meta.id, kind, lang, solution: "SKIP", starter: "-", worst: null, note: "", details: [], warnings: [] };
      rows.push(row);
      if (!ref) {
        row.solution = "FAIL";
        row.note = "reference_solutions が無い";
        continue;
      }
      const tool = TOOL[lang];
      if (!tool || (kind === "stdio" && !isRunnerLanguage(lang))) {
        row.note = `言語 ${lang} のローカル実行は未対応（runner の対象外）`;
        continue;
      }
      if (!hasTool(tool)) {
        row.note = `${tool} が無いためスキップ`;
        continue;
      }
      const refPath = path.join(dir, ref);
      if (kind === "stdio" && isRunnerLanguage(lang)) {
        await checkStdio(p, dir, lang, refPath, base, args, row);
      } else if (kind === "unit") {
        const work = await mkWork(base, `${p.meta.id}-${lang}`);
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
    if (args.naive && kind === "stdio") {
      const nr = await checkNaive(p, dir, base, args);
      naiveRows.push(...nr);
      if (nr.length === 0 && p.meta.category === "CP") noNaive.push(p.meta.id);
    }
  }

  if (args.only.length && matched === 0) {
    console.error(`--only ${args.only.join(",")} に一致する問題がありません（id・接頭辞・ディレクトリ名で指定）`);
    await fs.rm(base, { recursive: true, force: true });
    return 2;
  }

  const fmtMs = (t: Timing | null) => (t ? String(t.ms) : "-");
  const table = renderTable(
    ["id", "kind", "lang", "参照解", "starter", "最大ms", "制限ms", "比", "最遅ケース", "note"],
    rows.map((r) => [r.id, r.kind, r.lang, r.solution, r.starter, fmtMs(r.worst), r.worst ? String(r.worst.limitMs) : "-", r.worst ? pct(r.worst) : "-", r.worst?.caseName ?? "-", r.note]),
    ["left", "left", "left", "left", "left", "right", "right", "right", "left", "left"],
  );
  console.log(table);

  if (args.naive) {
    console.log("\n素朴解（gen/naive.*）: hidden-max-* のどれかで判定の TLE 閾値（制限 × 1.5）を超えること");
    if (naiveRows.length) {
      console.log(
        renderTable(
          ["id", "file", "lang", "判定", "最大ms", "閾値ms", "最遅ケース", "note"],
          naiveRows.map((r) => [r.id, r.file, r.lang, r.verdict, fmtMs(r.worst), r.thresholdMs !== null ? String(r.thresholdMs) : "-", r.worst?.caseName ?? "-", r.note]),
          ["left", "left", "left", "left", "right", "right", "left", "left"],
        ),
      );
    } else console.log("（対象の問題に gen/naive.* がありません）");
    if (noNaive.length) console.log(`gen/naive.* が無い CP 問題（計算量の罠が無い問題なら不要）: ${noNaive.join(", ")}`);
  }

  const warned = rows.filter((r) => r.warnings.length);
  if (warned.length) {
    console.log("\n時間の警告（参照解が制限の 50% を超えた。--timing では FAIL）:");
    for (const r of warned) for (const w of r.warnings) console.log(`  [warn] ${r.id} [${r.lang}] ${w}`);
  }
  const bad = rows.filter((r) => r.solution === "FAIL" || r.starter === "PASSES");
  for (const r of bad) {
    console.log(`\n--- ${r.id} [${r.lang}] ---`);
    for (const d of r.details) console.log("  " + d.split("\n").join("\n  "));
  }
  const badNaive = naiveRows.filter((r) => r.verdict === "PASSES" || r.verdict === "FAIL");
  for (const r of badNaive) {
    console.log(`\n--- ${r.id} ${r.file} [naive] ---`);
    for (const d of [r.note, ...r.details]) if (d) console.log("  " + d.split("\n").join("\n  "));
  }
  const pass = rows.filter((r) => r.solution === "PASS").length;
  const skip = rows.filter((r) => r.solution === "SKIP").length;
  let summary = `\n参照解 PASS ${pass} / FAIL ${rows.filter((r) => r.solution === "FAIL").length} / SKIP ${skip}、starter が通ってしまう ${rows.filter((r) => r.starter === "PASSES").length}、時間の警告 ${warned.reduce((a, r) => a + r.warnings.length, 0)}`;
  if (args.naive) summary += `、素朴解 TLE 確認 ${naiveRows.filter((r) => r.verdict === "TLE").length} / 落ちない・検査不可 ${badNaive.length}`;
  console.log(summary);
  if (args.keep) console.log(`作業ディレクトリを残しました: ${base}`);
  else await fs.rm(base, { recursive: true, force: true });
  return bad.length || badNaive.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    process.exit(1);
  },
);
