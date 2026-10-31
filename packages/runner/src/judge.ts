import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaseResult, Diagnostic, Problem, RunResult, Verdict } from "@lci/core";
import { InfraError, isRunnerLanguage, type Backend, type ExecLimits, type ExecResult, type JudgeRequest, type RunRequest, type RunnerLanguage, type SourceFile, type Workspace } from "./types.ts";
import { DEFAULT_LIMITS, DEFAULT_UNIT_PARSER, TIME_MULTIPLIER, compileCommand, pickEntry, runCommand, usesVirtualMemLimit } from "./languages.ts";
import { parseDiagnostics, parseRustPanic, renderRustcStderr } from "./diagnostics.ts";
import { compareOutput, head } from "./compare.ts";
import { isUnitParserId, parseUnitResults } from "./unit-parsers.ts";
import { HARNESS_SUPPORT_FILES } from "./templates.ts";

/**
 * 実行（Run）と採点（Judge）の本体。Backend に依存せず verdict を決める。
 * 02 FR-X-02 / FR-X-04。
 */

const RUN_STDOUT_KEEP = 32 * 1024;

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 02 FR-X-04-1 の分類。WA/AC の判断（出力比較）は呼び出し側 */
export function classifyExec(r: ExecResult, lang: RunnerLanguage, limitMs: number): Exclude<Verdict, "WA" | "PASS" | "FAIL" | "CE"> {
  if (r.error) return "IE";
  if (r.oomKilled) return "MLE";
  if (r.timedOut) return "TLE";
  if (r.outputExceeded) return "OLE";
  // 時間内に終わっても CPU 上限（×1.5 のマージン、02 非機能要件「再現性」）を超えていれば TLE
  if (r.timeMs > limitMs * 1.5) return "TLE";
  if (r.exitCode === 0) return "AC";
  if (r.exitCode === 153) return "OLE"; // SIGXFSZ (ulimit -f)
  if (r.exitCode === 137) return "MLE"; // SIGKILL だが時間切れではない: cgroup OOM の疑い
  if (looksLikeOom(lang, r.stderr)) return "MLE";
  return "RE";
}

function looksLikeOom(lang: RunnerLanguage, stderr: string): boolean {
  switch (lang) {
    case "python":
      return /MemoryError/.test(stderr);
    case "typescript":
      return /heap out of memory|Allocation failed/.test(stderr);
    case "php":
      return /Allowed memory size/.test(stderr);
    case "rust":
      return /memory allocation of \d+ bytes failed|out of memory/.test(stderr);
    case "go":
      return /runtime: out of memory|cannot allocate memory/.test(stderr);
    case "c":
      return /Cannot allocate memory/.test(stderr);
  }
}

const SEVERITY: Verdict[] = ["IE", "CE", "MLE", "TLE", "OLE", "RE", "WA", "FAIL", "AC", "PASS"];
export function worstVerdict(vs: Verdict[]): Verdict {
  let best: Verdict = "AC";
  let bi = SEVERITY.indexOf(best);
  for (const v of vs) {
    const i = SEVERITY.indexOf(v);
    if (i >= 0 && i < bi) {
      best = v;
      bi = i;
    }
  }
  return best;
}

interface Limits {
  timeMs: number;
  wallMs: number;
  memoryMb: number;
  outputKb: number;
}

function mergeLimits(lang: RunnerLanguage, ...layers: (Partial<Limits> | undefined)[]): Limits {
  const l: Limits = { timeMs: DEFAULT_LIMITS.timeMs, wallMs: DEFAULT_LIMITS.wallMs, memoryMb: DEFAULT_LIMITS.memoryMb, outputKb: DEFAULT_LIMITS.outputKb };
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.timeMs) l.timeMs = layer.timeMs;
    if (layer.wallMs) l.wallMs = layer.wallMs;
    if (layer.memoryMb) l.memoryMb = layer.memoryMb;
    if (layer.outputKb) l.outputKb = layer.outputKb;
  }
  const k = TIME_MULTIPLIER[lang];
  l.timeMs = Math.round(l.timeMs * k);
  // 壁時計は CPU 上限より短くならないようにする（係数適用後）
  l.wallMs = Math.max(Math.round(l.wallMs * k), l.timeMs);
  return l;
}

function execLimits(l: Limits): ExecLimits {
  return { wallMs: l.wallMs, memoryMb: l.memoryMb, outputKb: l.outputKb };
}

function infraResult(mode: "run" | "judge", req: { language: RunRequest["language"]; t?: number }, backend: Backend, message: string, started: number): RunResult {
  return {
    run_id: newRunId(),
    mode,
    language: req.language,
    started_at_wall: new Date(started).toISOString(),
    t: req.t ?? 0,
    verdict: "IE",
    duration_ms: Date.now() - started,
    stderr: message,
    cases: [],
    infra: { backend: backend.kind === "docker" ? "docker" : "none" },
  };
}

function requireLanguage(language: string): RunnerLanguage {
  if (!isRunnerLanguage(language)) throw new InfraError(`この言語は Docker 実行の対象外です: ${language}（html は iframe、sql/markdown は実行なし）`);
  return language;
}

interface CompileOutcome {
  ok: boolean;
  compile: NonNullable<RunResult["compile"]>;
}

async function compileStep(ws: Workspace, lang: RunnerLanguage, entry: string): Promise<CompileOutcome | undefined> {
  const cmd = compileCommand(lang, entry);
  if (!cmd) return undefined;
  const r = await ws.exec(cmd, { limits: { wallMs: DEFAULT_LIMITS.compileMs, outputKb: DEFAULT_LIMITS.compileOutputKb } });
  if (r.error) throw new InfraError(r.error);
  const rawErr = lang === "rust" ? renderRustcStderr(r.stderr) : r.stderr;
  const diagnostics = parseDiagnostics(lang, r.stderr);
  const ok = r.exitCode === 0 && !r.timedOut;
  const compile = {
    ok,
    stdout: head(r.stdout, 8192),
    stderr: head(r.timedOut ? `コンパイルが ${DEFAULT_LIMITS.compileMs / 1000} 秒以内に終わりませんでした\n${rawErr}` : rawErr, 16384),
    diagnostics: ok ? diagnostics.filter((d) => d.severity !== "error") : diagnostics,
    time_ms: r.timeMs,
  };
  return { ok, compile };
}

/** 実行時エラーの位置情報（Monaco マーカー用）を compile.diagnostics に追記する */
function runtimeDiagnostics(lang: RunnerLanguage, stderr: string): Diagnostic[] {
  if (!stderr) return [];
  if (lang === "rust") return parseRustPanic(stderr);
  if (lang === "c") return [];
  return parseDiagnostics(lang, stderr);
}

// ---- Run ------------------------------------------------------------------

export async function runOnce(backend: Backend, req: RunRequest): Promise<RunResult> {
  const started = Date.now();
  let lang: RunnerLanguage;
  try {
    lang = requireLanguage(req.language);
  } catch (e) {
    return infraResult("run", req, backend, (e as Error).message, started);
  }
  const entry = pickEntry(lang, req.files, req.entry);
  if (!entry) return infraResult("run", req, backend, "実行するファイルがありません", started);
  const limits = mergeLimits(lang, req.limits);
  let ws: Workspace;
  try {
    ws = await backend.open(lang, req.files);
  } catch (e) {
    return infraResult("run", req, backend, e instanceof Error ? e.message : String(e), started);
  }
  const base: RunResult = {
    run_id: newRunId(),
    mode: "run",
    language: req.language,
    started_at_wall: new Date(started).toISOString(),
    t: req.t ?? 0,
    verdict: "IE",
    duration_ms: 0,
    cases: [],
    infra: { backend: backend.kind === "docker" ? "docker" : "none", image: backend.image(lang) },
  };
  try {
    const c = await compileStep(ws, lang, entry);
    if (c) base.compile = c.compile;
    if (c && !c.ok) {
      return { ...base, verdict: "CE", duration_ms: Date.now() - started };
    }
    const r = await ws.exec(runCommand(lang, entry, limits.memoryMb, "run"), { stdin: req.stdin ?? "", limits: execLimits(limits), applyMemLimit: usesVirtualMemLimit(lang) });
    const verdict = classifyExec(r, lang, limits.timeMs);
    if (verdict === "TLE" || verdict === "MLE" || verdict === "OLE" || verdict === "IE") ws.taint();
    if (verdict === "IE") return { ...base, verdict, duration_ms: Date.now() - started, stderr: r.error };
    const rd = verdict === "RE" ? runtimeDiagnostics(lang, r.stderr) : [];
    if (rd.length) base.compile = base.compile ? { ...base.compile, diagnostics: [...base.compile.diagnostics, ...rd] } : { ok: true, stdout: "", stderr: "", diagnostics: rd, time_ms: 0 };
    let stderr = head(r.stderr, RUN_STDOUT_KEEP);
    if (verdict === "TLE") stderr = `${limits.wallMs} ms で打ち切りました（無限ループの可能性）。stdout は途中まで残っています。\n` + stderr;
    if (verdict === "OLE") stderr = `出力が上限（${limits.outputKb} KiB）を超えたため打ち切りました。\n` + stderr;
    if (verdict === "MLE") stderr = `メモリ上限（${limits.memoryMb} MB）を超えました。\n` + stderr;
    return {
      ...base,
      verdict,
      exit_code: r.exitCode,
      duration_ms: Date.now() - started,
      stdout: head(r.stdout, RUN_STDOUT_KEEP),
      stderr,
      cases: [{ name: "run", visibility: "sample", verdict, time_ms: r.timeMs, memory_kb: r.memoryKb, tags: [] }],
    };
  } catch (e) {
    ws.taint();
    return { ...base, verdict: "IE", duration_ms: Date.now() - started, stderr: e instanceof Error ? e.message : String(e) };
  } finally {
    await ws.close();
  }
}

// ---- Judge ----------------------------------------------------------------

async function readProblemFile(problemsRoot: string, problem: Problem, rel: string): Promise<string> {
  const abs = path.resolve(problemsRoot, problem.dir, rel);
  const root = path.resolve(problemsRoot, problem.dir);
  if (!abs.startsWith(root + path.sep)) throw new InfraError(`問題ディレクトリ外のファイルは参照できません: ${rel}`);
  return fs.readFile(abs, "utf8");
}

export async function judgeProblem(backend: Backend, problem: Problem, req: JudgeRequest): Promise<RunResult> {
  const started = Date.now();
  let lang: RunnerLanguage;
  try {
    lang = requireLanguage(req.language);
  } catch (e) {
    return infraResult("judge", req, backend, (e as Error).message, started);
  }
  if (problem.tests.kind === "stdio") return judgeStdio(backend, problem, problem.tests, lang, req, started);
  if (problem.tests.kind === "unit") return judgeUnit(backend, problem, problem.tests, lang, req, started);
  return infraResult("judge", req, backend, `kind=${problem.tests.kind} の問題はサーバ側では採点しません（web はブラウザ内で判定）`, started);
}

type StdioTests = Extract<Problem["tests"], { kind: "stdio" }>;
type UnitTests = Extract<Problem["tests"], { kind: "unit" }>;

async function judgeStdio(backend: Backend, problem: Problem, tests: StdioTests, lang: RunnerLanguage, req: JudgeRequest, started: number): Promise<RunResult> {
  const entry = pickEntry(lang, req.files);
  if (!entry) return infraResult("judge", req, backend, "提出ファイルがありません", started);
  const base: RunResult = {
    run_id: newRunId(),
    mode: "judge",
    language: req.language,
    started_at_wall: new Date(started).toISOString(),
    t: req.t ?? 0,
    verdict: "IE",
    duration_ms: 0,
    cases: [],
    infra: { backend: backend.kind === "docker" ? "docker" : "none", image: backend.image(lang) },
  };
  // テスト入力を先に読む（ファイル欠損は IE として採点前に返す）
  const selected = tests.cases.filter((c) => req.visibility !== "sample" || c.visibility === "sample");
  const inputs: { stdin: string; expected: string }[] = [];
  try {
    for (const c of selected) {
      const stdin = c.stdin ?? (c.stdinFile ? await readProblemFile(req.problemsRoot, problem, c.stdinFile) : "");
      const expected = c.expected ?? (c.expectedFile ? await readProblemFile(req.problemsRoot, problem, c.expectedFile) : "");
      inputs.push({ stdin, expected });
    }
  } catch (e) {
    return { ...base, duration_ms: Date.now() - started, stderr: `テストデータの読み込みに失敗: ${e instanceof Error ? e.message : String(e)}` };
  }
  let ws: Workspace;
  try {
    ws = await backend.open(lang, req.files);
  } catch (e) {
    return { ...base, duration_ms: Date.now() - started, stderr: e instanceof Error ? e.message : String(e) };
  }
  try {
    const c = await compileStep(ws, lang, entry);
    if (c) base.compile = c.compile;
    if (c && !c.ok) return { ...base, verdict: "CE", duration_ms: Date.now() - started };

    const cases: CaseResult[] = [];
    let consecutiveTle = 0;
    let stopped: string | undefined;
    for (let i = 0; i < selected.length; i++) {
      const tc = selected[i]!;
      const limits = mergeLimits(lang, tests.limits, tc.limits);
      const r = await ws.exec(runCommand(lang, entry, limits.memoryMb, "judge"), { stdin: inputs[i]!.stdin, limits: execLimits(limits), applyMemLimit: usesVirtualMemLimit(lang) });
      let verdict: Verdict = classifyExec(r, lang, limits.timeMs);
      let message: string | undefined;
      if (verdict === "IE") {
        ws.taint();
        cases.push({ name: tc.name, visibility: tc.visibility, verdict, message: r.error, tags: [] });
        stopped = "基盤障害";
        break;
      }
      if (verdict === "AC") {
        const cmp = compareOutput(r.stdout, inputs[i]!.expected, tests.compare);
        if (!cmp.ok) {
          verdict = "WA";
          message = cmp.message;
        }
      } else if (verdict === "TLE") {
        message = `${r.timedOut ? limits.wallMs : r.timeMs} ms で打ち切り（上限 ${limits.timeMs} ms）。無限ループの可能性があります`;
      } else if (verdict === "RE") {
        message = `exit code ${r.exitCode}`;
        const rd = runtimeDiagnostics(lang, r.stderr);
        if (rd[0]) message += `: ${rd[0].message}` + (rd[0].line ? `（${rd[0].file ?? entry}:${rd[0].line}）` : "");
      } else if (verdict === "OLE") {
        message = `出力が ${limits.outputKb} KiB を超えました`;
      } else if (verdict === "MLE") {
        message = `メモリ上限 ${limits.memoryMb} MB を超えました`;
      }
      if (verdict === "TLE" || verdict === "MLE" || verdict === "OLE") ws.taint();
      cases.push({
        name: tc.name,
        visibility: tc.visibility,
        verdict,
        time_ms: r.timeMs,
        memory_kb: r.memoryKb,
        // hidden ケースの期待値は UI に出さない方針だが、評価ログ（Claude 向け）には先頭だけ残す
        stdout: head(r.stdout),
        expected: head(inputs[i]!.expected),
        stderr: r.stderr ? head(r.stderr, 2048) : undefined,
        message,
        tags: [],
      });
      consecutiveTle = verdict === "TLE" ? consecutiveTle + 1 : 0;
      if (consecutiveTle >= tests.stopOn.consecutiveTle) {
        stopped = `TLE が ${consecutiveTle} 回連続したため残り ${selected.length - i - 1} 件を省略`;
        break;
      }
      if (tests.stopOn.firstFail && verdict !== "AC") {
        stopped = `最初の失敗で打ち切り（残り ${selected.length - i - 1} 件）`;
        break;
      }
    }
    return {
      ...base,
      verdict: worstVerdict(cases.map((c) => c.verdict)),
      duration_ms: Date.now() - started,
      stderr: stopped,
      cases,
    };
  } catch (e) {
    ws.taint();
    return { ...base, verdict: "IE", duration_ms: Date.now() - started, stderr: e instanceof Error ? e.message : String(e) };
  } finally {
    await ws.close();
  }
}

async function judgeUnit(backend: Backend, problem: Problem, tests: UnitTests, lang: RunnerLanguage, req: JudgeRequest, started: number): Promise<RunResult> {
  const base: RunResult = {
    run_id: newRunId(),
    mode: "judge",
    language: req.language,
    started_at_wall: new Date(started).toISOString(),
    t: req.t ?? 0,
    verdict: "IE",
    duration_ms: 0,
    cases: [],
    infra: { backend: backend.kind === "docker" ? "docker" : "none", image: backend.image(lang) },
  };
  const harness = tests.harness[lang];
  const userEntry = tests.userEntry[lang];
  if (!harness || !userEntry) return { ...base, duration_ms: Date.now() - started, stderr: `この問題には ${lang} のテストハーネスがありません` };

  // 1) ハーネスファイル（問題ディレクトリから basename で配置）
  const files: SourceFile[] = [];
  const taken = new Set<string>();
  try {
    for (const rel of harness.files) {
      const content = await readProblemFile(req.problemsRoot, problem, rel);
      const p = path.posix.basename(rel);
      files.push({ path: p, content });
      taken.add(p);
    }
  } catch (e) {
    return { ...base, duration_ms: Date.now() - started, stderr: `ハーネスの読み込みに失敗: ${e instanceof Error ? e.message : String(e)}` };
  }
  // 2) C/PHP の lci_assert を補う
  for (const s of HARNESS_SUPPORT_FILES[lang] ?? []) {
    if (!taken.has(s.path)) {
      files.push(s);
      taken.add(s.path);
    }
  }
  // 3) ユーザーファイル。userEntry 名のファイルが無ければ主ファイルをその名前に置く（ハーネスと衝突する名前は無視）
  const userFiles = req.files.filter((f) => !taken.has(f.path));
  if (!userFiles.some((f) => f.path === userEntry)) {
    const main = pickEntry(lang, userFiles);
    if (!main) return { ...base, duration_ms: Date.now() - started, stderr: "提出ファイルがありません" };
    const f = userFiles.find((x) => x.path === main)!;
    files.push({ path: userEntry, content: f.content });
    for (const g of userFiles) if (g.path !== main) files.push(g);
  } else {
    files.push(...userFiles);
  }

  const limits = mergeLimits(lang, tests.limits);
  const compiled = lang === "c" || lang === "rust" || lang === "go";
  // コマンドがコンパイルを含む言語はコンパイル枠を足す
  const wallMs = compiled ? limits.wallMs + DEFAULT_LIMITS.compileMs : limits.wallMs;
  const parser = isUnitParserId(harness.resultParser) ? harness.resultParser : DEFAULT_UNIT_PARSER[lang];

  let ws: Workspace;
  try {
    ws = await backend.open(lang, files);
  } catch (e) {
    return { ...base, duration_ms: Date.now() - started, stderr: e instanceof Error ? e.message : String(e) };
  }
  try {
    const r = await ws.exec(["bash", "-c", harness.command], {
      stdin: "",
      limits: { wallMs, memoryMb: limits.memoryMb, outputKb: limits.outputKb },
      applyMemLimit: usesVirtualMemLimit(lang),
    });
    const execVerdict = classifyExec(r, lang, compiled ? limits.timeMs + DEFAULT_LIMITS.compileMs : limits.timeMs);
    if (execVerdict !== "AC" && execVerdict !== "RE") ws.taint();
    if (execVerdict === "IE") return { ...base, duration_ms: Date.now() - started, stderr: r.error };

    const results = parseUnitResults(parser, r.stdout, r.stderr);
    const cases: CaseResult[] = results.map((t) => ({
      name: t.name,
      visibility: "sample" as const,
      verdict: t.ok ? ("PASS" as const) : ("FAIL" as const),
      time_ms: t.timeMs,
      message: t.message,
      tags: [],
    }));
    const stderrText = lang === "rust" ? renderRustcStderr(r.stderr) : r.stderr;

    if (results.length === 0) {
      // 何も解析できない: コンパイルエラーなら CE、それ以外は実行段階の verdict（RE/TLE…）
      const diags = parseDiagnostics(lang, r.stderr);
      const hasCompileError = diags.some((d) => d.severity === "error") && (r.exitCode !== 0 || execVerdict !== "AC");
      if (hasCompileError && execVerdict !== "TLE" && execVerdict !== "MLE") {
        return {
          ...base,
          verdict: "CE",
          compile: { ok: false, stdout: head(r.stdout, 8192), stderr: head(stderrText, 16384), diagnostics: diags, time_ms: r.timeMs },
          exit_code: r.exitCode,
          duration_ms: Date.now() - started,
        };
      }
      return {
        ...base,
        verdict: execVerdict === "AC" ? "IE" : execVerdict,
        exit_code: r.exitCode,
        duration_ms: Date.now() - started,
        stdout: head(r.stdout, RUN_STDOUT_KEEP),
        stderr: execVerdict === "AC" ? `テスト結果を解析できませんでした（parser=${parser}）\n` + head(stderrText, RUN_STDOUT_KEEP) : head(stderrText, RUN_STDOUT_KEEP),
      };
    }
    const allOk = cases.every((c) => c.verdict === "PASS");
    const verdict: Verdict = execVerdict !== "AC" && execVerdict !== "RE" ? execVerdict : allOk ? "AC" : "WA";
    const rd = allOk ? [] : runtimeDiagnostics(lang, r.stderr);
    return {
      ...base,
      verdict,
      compile: rd.length ? { ok: true, stdout: "", stderr: "", diagnostics: rd, time_ms: 0 } : undefined,
      exit_code: r.exitCode,
      duration_ms: Date.now() - started,
      stdout: head(r.stdout, RUN_STDOUT_KEEP),
      stderr: head(stderrText, RUN_STDOUT_KEEP),
      cases,
    };
  } catch (e) {
    ws.taint();
    return { ...base, verdict: "IE", duration_ms: Date.now() - started, stderr: e instanceof Error ? e.message : String(e) };
  } finally {
    await ws.close();
  }
}
