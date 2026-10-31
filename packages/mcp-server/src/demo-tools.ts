import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Category, Language } from "@lci/core";
import {
  DEMO_GUIDE,
  DemoDraft,
  DemoService,
  GUIDE_VERSION,
  LIMITS,
  TIMING,
  coverIds,
  demoFileFor,
  demoSupported,
  demoUrl,
  findProblemById,
  loadProblemsLenient,
  readReferenceSolutions,
  redFlagIds,
  sampleCases,
  unsupportedReason,
  type DemoIssue,
  type ValidationReport,
} from "@lci/demo";

/**
 * 模範解答デモの MCP ツール（02 §6、00 D16）。
 * get_problem_for_demo → validate_demo_script（何度でも）→ save_demo_script の順に使う。
 * 音声合成は MCP の応答に含めない: save の後に切り離した子プロセス（@lci/demo の cli.ts synth）で行う。
 */

export interface DemoToolsConfig {
  dataRoot: string;
  problemsRoot: string;
  /** 保存結果の URL に付けるアプリの起点（既定 http://localhost:3000） */
  appUrl?: string;
  /** テスト用: save 後に音声合成の子プロセスを起動しない */
  spawnAudio?: boolean;
}

const json = (v: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(v, null, 1) }] });
const failJson = (v: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: JSON.stringify(v, null, 1) }] });
const fail = (e: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });

async function guard(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
}

/**
 * draft の入力スキーマ。SDK の zod 検証で弾くと構造化エラー（step_id・直し方）を返せないので、
 * 値は何でも受け取り（検証は validate が行う）、JSON Schema だけは DemoDraft のものを見せる。
 */
const draftJsonSchema = (() => {
  const s = z.toJSONSchema(DemoDraft, { target: "draft-7", io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
})();
const DraftInput = z.unknown().meta({ ...draftJsonSchema, description: "DemoDraft（台本）。形はオーサリングガイド（lci://guides/demo-authoring）を参照。検証は validate_demo_script が行う" });

const ProblemId = z.string().describe("問題 ID（例: alg-0001。list_problems で取得）");
const Lang = Language.describe("言語（問題の languages のどれか。例: python）");
const DemoIdArg = z.string().describe("デモ ID（d_YYYYMMDDTHHMMSS_xxxx。list_demos で取得）");

function issueLine(i: DemoIssue): string {
  return `${i.code}${i.step_id ? ` [${i.step_id}]` : ""}: ${i.message}`;
}

function cliPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.resolve("@lci/demo"))), "cli.ts");
}

export function registerDemoTools(server: McpServer, cfg: DemoToolsConfig): DemoService {
  const svc = new DemoService({ dataRoot: cfg.dataRoot, problemsRoot: cfg.problemsRoot });
  const appUrl = (cfg.appUrl ?? process.env.LCI_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  /** 手順逸脱の記録（server.ts の seen と同じ考え方）: 読んだ問題・検証を通した digest */
  const readProblems = new Set<string>();
  const validated = new Set<string>();

  /** 音声合成を切り離した子プロセスで始める（MCP の応答を待たせない。クライアントが MCP を閉じても続く） */
  const spawnSynth = async (demoId: string, revision: number): Promise<boolean> => {
    if (cfg.spawnAudio === false) return false;
    const dir = await svc.store.audioDir(demoId);
    if (!dir) return false;
    const { promises: fs } = await import("node:fs");
    await fs.mkdir(dir, { recursive: true });
    const log = openSync(path.join(dir, "synth.log"), "a");
    try {
      const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", cliPath(), "synth", demoId, "--revision", String(revision)], {
        detached: true,
        stdio: ["ignore", log, log],
        env: { ...process.env, LCI_DATA_ROOT: cfg.dataRoot },
      });
      child.on("error", () => undefined);
      child.unref();
      return true;
    } finally {
      closeSync(log);
    }
  };

  server.registerTool(
    "list_problems",
    {
      title: "問題一覧（デモ用）",
      description: "問題の一覧。demo_supported はデモを作れる問題（stdio / unit。web は v1.1）。demos は既存のデモ。",
      inputSchema: {
        category: Category.optional(),
        judge_kind: z.enum(["stdio", "unit", "web", "none"]).optional(),
        language: Language.optional(),
        has_demo: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (a) =>
      guard(async () => {
        const ps = await loadProblemsLenient(cfg.problemsRoot);
        const demos = await svc.summaries();
        const out = [];
        for (const p of ps) {
          if (a.category && p.meta.category !== a.category) continue;
          if (a.judge_kind && p.tests.kind !== a.judge_kind) continue;
          if (a.language && !p.meta.languages.includes(a.language)) continue;
          const mine = demos.filter((d) => d.problem_id === p.meta.id && (!a.language || d.language === a.language));
          if (a.has_demo !== undefined && a.has_demo !== mine.length > 0) continue;
          out.push({
            id: p.meta.id,
            title: p.meta.title,
            category: p.meta.category,
            difficulty: p.meta.difficulty,
            time_limit_min: p.meta.time_limit,
            languages: p.meta.languages,
            judge_kind: p.tests.kind,
            demo_supported: demoSupported(p),
            demos: mine.map((d) => ({ language: d.language, demo_id: d.demo_id, revision: d.revision, duration_s: Math.round(d.estimate_ms / 1000), audio_status: d.audio_status })),
          });
        }
        return json(out.slice(0, a.limit ?? 200));
      }),
  );

  server.registerTool(
    "get_problem_for_demo",
    {
      title: "デモ作成用の問題情報",
      description:
        "デモを書く前に必ず 1 回呼ぶ。問題文・制約・requirements・talking_points・red_flags（rf1…）・採点ヒント・面接官メモ・解説・判定の種類とサンプル・編集するファイル（file.content は生テキスト）・参照解（生テキスト）・上限値・オーサリングガイド全文・既存のデモを返す。web 問題は v1.1 まで作れない。",
      inputSchema: { problem_id: ProblemId, language: Lang },
      annotations: { readOnlyHint: true },
    },
    async ({ problem_id, language }) =>
      guard(async () => {
        const p = await findProblemById(cfg.problemsRoot, problem_id);
        if (!p) throw new Error(`問題が見つかりません: ${problem_id}（list_problems で id を確認してください）`);
        const why = unsupportedReason(p);
        if (why) throw new Error(why);
        if (!p.meta.languages.includes(language)) throw new Error(`${problem_id} は ${language} に対応していません（対応: ${p.meta.languages.join(", ")}）`);
        const file = demoFileFor(p, language);
        const refs = await readReferenceSolutions(cfg.problemsRoot, p);
        const refLang = refs[language] !== undefined ? language : Object.keys(refs)[0];
        const samples = await sampleCases(cfg.problemsRoot, p);
        const ids = coverIds(p.meta);
        readProblems.add(`${problem_id}:${language}`);
        const limitMin = p.meta.time_limit;
        return json({
          problem: { id: p.meta.id, title: p.meta.title, category: p.meta.category, difficulty: p.meta.difficulty, time_limit_min: limitMin, interviewer_mode: p.meta.interviewer_mode, allow_questions: p.meta.allow_questions },
          statement: p.body.statement,
          constraints: p.body.constraints,
          requirements: p.meta.requirements,
          talking_points: p.meta.talking_points,
          red_flags: redFlagIds(p),
          rubric_hints: { correctness: p.meta.rubric_hints.correctness, explanation: p.meta.rubric_hints.explanation, time_management: p.meta.rubric_hints.time_management, checklist: p.meta.rubric_hints.checklist },
          interviewer_notes: p.body.interviewer_notes,
          review_notes: p.body.review_notes,
          judge: {
            kind: p.tests.kind,
            server_judgeable: true,
            total_cases: p.tests.kind === "stdio" ? p.tests.cases.length : undefined,
            sample_cases: samples,
            run_modes: p.tests.kind === "stdio" ? ["sample", "stdin", "judge"] : ["sample", "judge"],
          },
          file: { path: file.path, base: file.base, content: file.content },
          reference: refLang ? { language: refLang, content: refs[refLang], other_languages: Object.keys(refs).filter((l) => l !== refLang) } : null,
          cover_ids: ids,
          limits: {
            ...LIMITS,
            time_limit_min: limitMin,
            target_minutes: [Math.round(limitMin * 0.5 * 10) / 10, Math.round(limitMin * 0.7 * 10) / 10],
            max_minutes: Math.min(limitMin, 20),
            typing_cps: [TIMING.typeCpsMin, TIMING.typeCpsMax],
            silent_typing_warn_s: TIMING.silentWarnMs / 1000,
            silent_typing_max_s: TIMING.silentErrorMs / 1000,
            sentence_max_chars: 60,
          },
          existing_demos: await svc.summaries({ problem_id, language }),
          guide_version: GUIDE_VERSION,
          guide: DEMO_GUIDE,
          note: "file.content と reference.content は生テキスト（行番号なし）。replace の old は file.content（にそれまでの操作を当てたもの）から一字一句コピーする。reference は方針の確認用で、デモのコードはこれと同じ方針にする",
        });
      }),
  );

  const summarize = (r: ValidationReport) => ({
    ...r,
    next: r.ok ? "ok です。同じ draft で save_demo_script を呼んでください（warnings はできれば直す）" : "errors を直して、もう一度 validate_demo_script を呼んでください（hint と context を参照）",
  });

  server.registerTool(
    "validate_demo_script",
    {
      title: "台本を検証",
      description:
        "保存せずに台本を検証する（スキーマ→操作の適用→各 run と最終コードの実行・判定→タイミング→デモ自身の指標→網羅→ナレーション lint）。エラーは ok:false と errors[{code, step_id, path, message, hint, context}] で返す（isError にはしない）。estimate に推定の長さとステップごとの説明・打鍵・無発話の秒数を返す。",
      inputSchema: { problem_id: ProblemId, language: Lang, draft: DraftInput },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ problem_id, language, draft }) =>
      guard(async () => {
        const r = await svc.validate({ problem_id, language, draft });
        if (r.ok && r.digest) validated.add(r.digest);
        return json(summarize(r));
      }),
  );

  server.registerTool(
    "save_demo_script",
    {
      title: "台本を保存",
      description:
        "台本を検証し、通れば新しい版として data/demos/<problem>/<lang>/<demo_id>/ に保存する（検証に通らなければ isError で validate と同じ JSON を返し、保存しない）。demo_id を渡すと既存デモの新しい版になる。返す url をアプリで開くと再生できる。音声はアプリ側で後から合成する（字幕だけでも再生できる）。",
      inputSchema: {
        problem_id: ProblemId,
        language: Lang,
        draft: DraftInput,
        demo_id: DemoIdArg.optional().describe("既存デモの新しい版にするとき"),
        note: z.string().max(500).optional().describe("作り直しの理由など"),
        model: z.string().max(80).optional().describe("台本を書いたモデル名（分かれば）"),
      },
    },
    async ({ problem_id, language, draft, demo_id, note, model }) =>
      guard(async () => {
        const proc: DemoIssue[] = [];
        if (!readProblems.has(`${problem_id}:${language}`)) proc.push({ code: "W_PROCEDURE", message: "get_problem_for_demo を参照せずに保存されました" });
        const res = await svc.save({ problem_id, language, draft, demo_id, note, model, route: "mcp" });
        if (!res.ok) return failJson(summarize(res.report));
        if (res.report.digest && !validated.has(res.report.digest)) proc.push({ code: "W_PROCEDURE", message: "同じ台本で validate_demo_script を呼ばずに保存されました（保存時に検証は済んでいます）" });
        const eng = await svc.engine();
        let audio: "generating" | "unavailable" = "unavailable";
        let audio_note = eng.reason ?? "";
        if (eng.engine && (await spawnSynth(res.demo_id, res.revision))) {
          audio = "generating";
          audio_note = `音声を ${eng.engine.id}（${eng.engine.voice}）で合成しています。合成が終わるまでは字幕だけで再生できます`;
        } else if (eng.engine) {
          audio_note = "アプリでデモを開くと音声を合成できます";
        }
        return json({
          demo_id: res.demo_id,
          revision: res.revision,
          url: res.url,
          open_url: `${appUrl}${res.url}`,
          audio,
          audio_note,
          duration_s: res.report.estimate?.duration_s,
          judge: res.report.judge ? { verdict: res.report.judge.verdict, passed: res.report.judge.passed, total: res.report.judge.total } : undefined,
          runner_backend: res.report.runner_backend,
          warnings: [...res.report.warnings, ...proc].map(issueLine),
          report_to_user: "URL と、self_check の要点を 2〜3 行で伝えてください",
        });
      }),
  );

  server.registerTool(
    "list_demos",
    {
      title: "デモ一覧",
      description: "保存済みのデモ（新しい順）。台本の中身は含まない。",
      inputSchema: { problem_id: ProblemId.optional(), language: Lang.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ problem_id, language }) =>
      guard(async () => {
        const list = await svc.summaries({ problem_id, language });
        return json(
          list.map((d) => ({
            demo_id: d.demo_id,
            problem_id: d.problem_id,
            language: d.language,
            title: d.title,
            revision: d.revision,
            revisions_count: d.revisions_count,
            duration_s: Math.round(d.estimate_ms / 1000),
            timing_source: d.audio_status === "ready" ? "measured" : "estimated",
            audio_status: d.audio_status,
            final_verdict: d.final_verdict,
            passed: d.passed,
            total: d.total,
            created_at: d.created_at,
            problem_updated: d.problem_updated,
            url: demoUrl(d.problem_id, d.language, d.demo_id),
          })),
        );
      }),
  );

  server.registerTool(
    "get_demo_script",
    {
      title: "保存済みの台本",
      description: "保存済みデモの draft（直して save_demo_script に demo_id 付きで渡せる形）と検証の要約・版の一覧。",
      inputSchema: { demo_id: DemoIdArg, revision: z.number().int().min(1).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ demo_id, revision }) =>
      guard(async () => {
        const s = await svc.store.getScript(demo_id, revision);
        if (!s) throw new Error(`デモが見つかりません: ${demo_id}${revision ? ` rev ${revision}` : ""}`);
        return json({
          demo_id: s.demo_id,
          revision: s.revision,
          problem_id: s.problem.id,
          language: s.language,
          url: demoUrl(s.problem.id, s.language, s.demo_id),
          draft: s.draft,
          note: s.note,
          validation: {
            validated_at: s.validation.validated_at,
            runner_backend: s.validation.runner_backend,
            final_judge: { verdict: s.validation.final_judge.verdict, passed: s.validation.final_judge.passed, total: s.validation.final_judge.total },
            estimate_s: Math.round(s.validation.estimate_ms / 1000),
            warnings: s.validation.warnings,
            self_metrics: s.validation.self_metrics,
          },
          revisions: await svc.revisions(demo_id),
        });
      }),
  );

  server.registerTool(
    "delete_demo",
    {
      title: "デモを削除",
      description: "デモを削除する。revision を渡すとその版だけ、省略するとデモを丸ごと（全版・音声）消す。元に戻せない。",
      inputSchema: { demo_id: DemoIdArg, revision: z.number().int().min(1).optional() },
      annotations: { destructiveHint: true },
    },
    async ({ demo_id, revision }) =>
      guard(async () => {
        const r = await svc.remove(demo_id, { revision });
        if (!r) throw new Error(`デモが見つかりません: ${demo_id}${revision ? ` rev ${revision}` : ""}`);
        return json({ deleted: true, demo_deleted: r.demo_deleted, freed_bytes: r.freed_bytes });
      }),
  );

  // ---- resources / prompt -------------------------------------------------------
  server.registerResource("demo-authoring-guide", "lci://guides/demo-authoring", { title: "模範解答デモ オーサリングガイド", mimeType: "text/markdown" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: DEMO_GUIDE }],
  }));
  server.registerResource(
    "demo-script",
    new ResourceTemplate("lci://demos/{demo_id}/script.json", {
      list: async () => ({
        resources: (await svc.summaries()).slice(0, 50).map((d) => ({ uri: `lci://demos/${d.demo_id}/script.json`, name: `${d.problem_id} ${d.language} ${d.title}`, mimeType: "application/json" })),
      }),
    }),
    { title: "デモの台本（DemoScript）", mimeType: "application/json" },
    async (uri, vars) => {
      const id = (Array.isArray(vars.demo_id) ? vars.demo_id[0] : vars.demo_id) ?? "";
      const s = await svc.store.getScript(id);
      if (!s) throw new Error(`デモが見つかりません: ${id}`);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(s, null, 1) }] };
    },
  );

  server.registerPrompt(
    "author_demo",
    {
      title: "模範解答デモを作る",
      description: "問題と言語を指定して、模範解答デモ（ナレーション＋ライブコーディングの台本）を書き、検証して保存する手順付きプロンプト",
      argsSchema: {
        problem_id: z.string().describe("問題 ID（例: alg-0001）"),
        language: z.string().describe("言語（例: python）"),
        target_minutes: z.string().optional().describe("目標の長さ（分）。省略時は制限時間の 50〜70%"),
        focus: z.string().optional().describe("特に見せたいこと（例: 計算量の見積もり、境界値のテスト）"),
      },
    },
    ({ problem_id, language, target_minutes, focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `LCI の問題 ${problem_id} の ${language} の模範解答デモを作ってください。`,
              target_minutes ? `目標の長さは ${target_minutes} 分です（draft.target_minutes に書く）。` : "長さは問題の制限時間の 50〜70% を目標にしてください。",
              focus ? `特に見せたいこと: ${focus}` : "",
              "",
              "手順:",
              `1. lci の get_problem_for_demo(problem_id="${problem_id}", language="${language}") を呼んで問題と編集するファイルを読む`,
              "2. 下のガイドに従って DemoDraft を書く",
              "3. validate_demo_script で検証し、ok:false なら errors の hint と context を見て直す（最大 4 回）",
              "4. ok:true になったら同じ draft で save_demo_script を呼ぶ（model に自分のモデル名を入れる）",
              "5. 返ってきた url（open_url）と、self_check の要点を 2〜3 行で報告する",
              "",
              DEMO_GUIDE,
            ]
              .filter((l) => l !== undefined)
              .join("\n"),
          },
        },
      ],
    }),
  );

  return svc;
}
