import path from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { RUBRIC_VERSION, SessionStore, fmtT, type Metrics } from "@lci/core";
import {
  FEW_SHOT_ANCHORS,
  KATAKANA_HINTS,
  RUBRIC_TEXT,
  EvaluationDraft,
  LenientEvaluationDraft,
  buildMcpEvaluatePrompt,
  draftToEvaluation,
  normalizeDraftTimes,
  promptHash,
  verifyEvaluation,
} from "@lci/evaluator";
import { registerDemoTools } from "./demo-tools.ts";
import {
  editLog,
  framesBetween,
  listSessions,
  problemReference,
  requireSession,
  sessionOverview,
  snapshotAt,
  timelineBins,
  transcriptRows,
  transcriptText,
} from "./data.ts";

/**
 * LCI の MCP サーバ（stdio）。Claude Desktop / Claude Code から練習セッションを読んで評価し、save_evaluation で保存する。
 * アプリ内評価（@lci/evaluator.evaluateSession）と同じルーブリック・同じ出力スキーマ（EvaluationDraft、時刻は経過秒）を使う（FR-E-07）。
 * 模範解答デモの台本ツール（get_problem_for_demo / validate_demo_script / save_demo_script …）は demo-tools.ts（@lci/demo）。
 * 依存は @lci/core・@lci/evaluator・@lci/demo のみ（Next.js に依存しない。00 D17）。
 */

export interface ServerConfig {
  dataRoot: string;
  problemsRoot: string;
  /** get_video_frames で Web カメラ映像を返してよいか（既定 false。03 §6.2 / FR-E-09） */
  allowCamera?: boolean;
  /** save_demo_script の後に音声合成の子プロセスを起動するか（既定 true。LCI_DEMO_SPAWN_AUDIO=0 で止める） */
  spawnAudio?: boolean;
}

export const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    dataRoot: env.LCI_DATA_ROOT ?? path.join(REPO_ROOT, "data"),
    problemsRoot: env.LCI_PROBLEMS_ROOT ?? path.join(REPO_ROOT, "problems"),
    allowCamera: env.LCI_MCP_ALLOW_CAMERA === "1",
    spawnAudio: env.LCI_DEMO_SPAWN_AUDIO !== "0",
  };
}

const json = (v: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(v, null, 1) }] });
const fail = (e: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });

async function guard(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
}

export function createServer(cfg: ServerConfig): McpServer {
  const store = new SessionStore(cfg.dataRoot);
  const server = new McpServer({ name: "lci", version: "0.1.0" }, { capabilities: { logging: {} } });
  /** 03 §7「MCP 経由での手順逸脱」: 同じプロセス内で transcript / edit_log を見たかを記録し、未参照なら保存時に警告する */
  const seen = new Map<string, Set<string>>();
  const mark = (id: string, what: string) => {
    if (!seen.has(id)) seen.set(id, new Set());
    seen.get(id)!.add(what);
  };

  const SessionId = z.string().describe("セッション ID（list_sessions で取得）");
  const Sec = z.number().min(0).describe("経過秒（セッション開始=0）");

  server.registerTool(
    "list_sessions",
    {
      title: "セッション一覧",
      description: "練習セッションの一覧（新しい順）。session_id, 問題, 開始時刻, 長さ(秒), 文字起こし有無, 評価数を返す。",
      inputSchema: { limit: z.number().int().min(1).max(200).optional(), problem_id: z.string().optional(), since: z.string().optional().describe("ISO8601。これ以降に開始したもの") },
      annotations: { readOnlyHint: true },
    },
    async (a) => guard(async () => json(await listSessions(store, a))),
  );

  server.registerTool(
    "get_session_overview",
    {
      title: "セッション概要",
      description: "最初に 1 回呼ぶ。問題文・言語・長さ・最終コード（全文、行番号付き）・実行結果サマリ・metrics（決定的に計算済みの指標）を返す。",
      inputSchema: { session_id: SessionId },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id }) =>
      guard(async () => {
        mark(session_id, "overview");
        return json(await sessionOverview(store, cfg.problemsRoot, session_id));
      }),
  );

  server.registerTool(
    "get_session_timeline",
    {
      title: "タイムライン（ビン集約）",
      description: "granularity_s 秒ごと（既定 10 秒）のビン: speech_chars（発話文字数）, edit_events, edit_lines, files_touched, run, silence。page でページング。",
      inputSchema: {
        session_id: SessionId,
        t0: Sec.optional(),
        t1: Sec.optional(),
        granularity_s: z.number().int().min(1).max(120).optional(),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(10).max(500).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id, ...o }) =>
      guard(async () => {
        mark(session_id, "timeline");
        return json(await timelineBins(store, session_id, o));
      }),
  );

  server.registerTool(
    "get_transcript",
    {
      title: "文字起こし",
      description:
        "範囲指定で文字起こしを返す（t0/t1 は経過秒）。各行 {t0,t1,at,text,confidence,markers}。markers は plan/question/restatement の機械判定。評価の transcript 引用は text から一字も変えずに抜くこと。",
      inputSchema: { session_id: SessionId, t0: Sec.optional(), t1: Sec.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id, t0, t1 }) =>
      guard(async () => {
        mark(session_id, "transcript");
        return json(await transcriptRows(store, session_id, t0, t1));
      }),
  );

  server.registerTool(
    "get_edit_log",
    {
      title: "編集ログ（要約）",
      description: "[t0, t1]（経過秒）の編集イベント要約 {t, at, file, range, kind, inserted, deleted, summary}。diff 本文は 200 文字で切る。page でページング。全文は get_code_snapshot_at。",
      inputSchema: {
        session_id: SessionId,
        t0: Sec,
        t1: Sec,
        file: z.string().optional().describe("ファイルパスまたは file_id"),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(20).max(1000).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id, ...o }) =>
      guard(async () => {
        mark(session_id, "edit_log");
        return json(await editLog(store, session_id, o));
      }),
  );

  server.registerTool(
    "get_code_snapshot_at",
    {
      title: "時刻 t のコード",
      description: "経過秒 t 時点のファイル全文（行番号付き）と、直前の定期スナップショットからの差分。file を省略すると全ファイル。",
      inputSchema: { session_id: SessionId, t: Sec, file: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id, t, file }) =>
      guard(async () => {
        mark(session_id, "snapshot");
        return json(await snapshotAt(store, cfg.problemsRoot, session_id, t, file));
      }),
  );

  server.registerTool(
    "get_problem_reference",
    {
      title: "問題の参照情報",
      description: "問題文・要件チェックリスト（id 付き）・トークポイント・採点ヒント・面接官メモ・想定解答方針・参照解。",
      inputSchema: { problem_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ problem_id }) => guard(async () => json(await problemReference(cfg.problemsRoot, problem_id))),
  );

  server.registerTool(
    "get_rubric",
    {
      title: "評価ルーブリック",
      description: "8 軸ルーブリック本文、few-shot アンカー、文字起こしの読み替え表。evaluate_session プロンプトと同じ内容。",
      inputSchema: { version: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ version }) =>
      guard(async () => {
        const note = version && version !== RUBRIC_VERSION ? `（要求された版 ${version} はありません。現行版を返します）\n\n` : "";
        return { content: [{ type: "text", text: `${note}${RUBRIC_TEXT}\n\n${FEW_SHOT_ANCHORS}\n\n${KATAKANA_HINTS}` }] };
      }),
  );

  server.registerTool(
    "get_metrics",
    {
      title: "指標",
      description: "アプリが決定的に計算した指標（沈黙・説明先行秒数・実行回数・方針変更など）。時刻は ms。数え直さず、この値を正とすること。",
      inputSchema: { session_id: SessionId },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id }) =>
      guard(async () => {
        await requireSession(store, session_id);
        const m = await store.getMetrics<Metrics>(session_id);
        if (!m) throw new Error("metrics がありません。アプリでセッションの終了処理（finalize）を実行してください");
        return json(m);
      }),
  );

  server.registerTool(
    "get_video_frames",
    {
      title: "画面キーフレーム",
      description:
        "finalize が出来事駆動で抽出した画面キーフレーム（実行直後・沈黙開始・方針変更・編集バースト境界・終了時）のうち [t0, t1] のものを最大 4 枚、各画像の前に時刻と理由の text を付けて返す。画像からコードを読み取らないこと。",
      inputSchema: {
        session_id: SessionId,
        t0: Sec,
        t1: Sec,
        strategy: z.enum(["keyframes"]).optional().describe("v1 は keyframes のみ"),
        max_frames: z.number().int().min(1).max(4).optional(),
        source: z.enum(["screen", "camera"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ session_id, t0, t1, max_frames, source }) =>
      guard(async () => {
        await requireSession(store, session_id);
        if (source === "camera" && !cfg.allowCamera) {
          throw new Error("Web カメラ映像は既定で渡しません（LCI_MCP_ALLOW_CAMERA=1 で許可）。source=screen を使ってください");
        }
        mark(session_id, "frames");
        const r = await framesBetween(store, session_id, { t0, t1, max_frames, source });
        if (!r.frames.length) return { content: [{ type: "text", text: `[${fmtT(t0 * 1000)}–${fmtT(t1 * 1000)}] にキーフレームはありません（画面録画なし、または範囲外）` }] };
        const content: CallToolResult["content"] = [];
        for (const f of r.frames) {
          content.push({ type: "text", text: `t=${fmtT(f.t)}（${Math.round(f.t / 1000)}s, ${f.reason}）` });
          content.push({ type: "image", data: f.data, mimeType: "image/jpeg" });
        }
        if (r.available > r.frames.length) content.push({ type: "text", text: `範囲内に他 ${r.available - r.frames.length} 枚あります。範囲を狭めて再取得してください。` });
        return { content };
      }),
  );

  server.registerTool(
    "save_evaluation",
    {
      title: "評価を保存",
      description:
        "評価 JSON を検証して保存し、アプリのレビュー画面に反映する。時刻（t, t_end, t0, t1, at, mentioned_at）は経過秒（mm:ss 文字列も可、サーバがミリ秒に変換）。overall はサーバが重み付き平均で計算する。transcript 引用は原文と照合され、一致しない feedback は speculative に降格される。",
      inputSchema: { session_id: SessionId, evaluation: LenientEvaluationDraft, model: z.string().optional().describe("評価したモデル名（分かれば）") },
    },
    async ({ session_id, evaluation, model }) =>
      guard(async () => {
        const s = await requireSession(store, session_id);
        const parsed = EvaluationDraft.safeParse(normalizeDraftTimes(evaluation));
        if (!parsed.success) {
          throw new Error(`評価 JSON がスキーマに合いません:\n${parsed.error.issues.slice(0, 10).map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
        }
        const events = await store.readEvents(session_id);
        const transcript = await store.getTranscript(session_id);
        const frames = s.finalize?.frames ?? 0;
        const ev = draftToEvaluation(parsed.data, {
          session_id,
          problem_id: s.problem.id,
          model: model ?? "mcp-client",
          route: "mcp",
          rubric_version: RUBRIC_VERSION,
          prompt_hash: promptHash(),
          input_digest: {
            transcript_segments: transcript?.segments.filter((x) => x.text.trim()).length ?? 0,
            edit_events: events.filter((e) => e.type === "edit").length,
            frames: seen.get(session_id)?.has("frames") ? frames : 0,
            metrics_version: "1",
          },
          duration_ms: s.ended_t,
        });
        const verified = verifyEvaluation(ev, transcript?.segments ?? []);
        const used = seen.get(session_id) ?? new Set<string>();
        const warnings: string[] = [];
        if (!used.has("edit_log") && !used.has("snapshot")) warnings.push("edit_log / code_snapshot を参照せずに評価されました");
        if (transcript && !used.has("transcript")) warnings.push("transcript を参照せずに評価されました");
        const final = { ...verified.evaluation, uncertainties: [...verified.evaluation.uncertainties, ...warnings.map((w) => `[MCP 手順] ${w}`)] };
        const rel = await store.saveEvaluation(session_id, final);
        return json({
          evaluation_id: rel,
          overall: final.scores.overall,
          demoted_to_speculative: verified.demoted,
          warnings: [...warnings, ...verified.notes],
        });
      }),
  );

  // ---- resources --------------------------------------------------------------
  const listTemplate = (suffix: string, mime: string) =>
    new ResourceTemplate(`lci://sessions/{id}/${suffix}`, {
      list: async () => ({
        resources: (await store.list()).slice(0, 50).map((s) => ({ uri: `lci://sessions/${s.session_id}/${suffix}`, name: `${s.session_id} ${suffix}`, mimeType: mime })),
      }),
    });
  const idOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  server.registerResource(
    "session-overview",
    listTemplate("overview.json", "application/json"),
    { title: "セッション概要", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await sessionOverview(store, cfg.problemsRoot, idOf(vars.id)), null, 1) }] }),
  );
  server.registerResource(
    "session-transcript",
    listTemplate("transcript", "text/plain"),
    { title: "文字起こし（タイムスタンプ付き）", mimeType: "text/plain" },
    async (uri, vars) => {
      const r = await transcriptRows(store, idOf(vars.id));
      const text = r.available ? transcriptText(r.rows as { at: string; text: string }[]) : String(r.note);
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text }] };
    },
  );
  server.registerResource(
    "session-metrics",
    listTemplate("metrics.json", "application/json"),
    { title: "指標", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await store.getMetrics(idOf(vars.id)), null, 1) }] }),
  );
  server.registerResource(
    "session-final-code",
    listTemplate("final", "text/plain"),
    { title: "最終コード", mimeType: "text/plain" },
    async (uri, vars) => {
      const o = await sessionOverview(store, cfg.problemsRoot, idOf(vars.id));
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: o.final_code.map((f) => `### ${f.path}\n${f.code}`).join("\n\n") }] };
    },
  );
  server.registerResource("rubric-current", "lci://rubric/current", { title: "評価ルーブリック", mimeType: "text/markdown" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: `${RUBRIC_TEXT}\n\n${FEW_SHOT_ANCHORS}` }],
  }));

  // ---- prompts ----------------------------------------------------------------
  server.registerPrompt(
    "evaluate_session",
    {
      title: "セッションを評価",
      description: "LCI のルーブリックでセッションを評価し save_evaluation で保存する手順付きプロンプト",
      argsSchema: {
        session_id: z.string().describe("評価するセッション ID"),
        include_video: z.string().optional().describe("\"true\" で画面キーフレームも参照する"),
      },
    },
    ({ session_id, include_video }) => ({
      messages: [{ role: "user", content: { type: "text", text: buildMcpEvaluatePrompt(session_id, { includeVideo: include_video === "true" }) } }],
    }),
  );

  // ---- 模範解答デモ（02 §6） ----------------------------------------------------
  registerDemoTools(server, { dataRoot: cfg.dataRoot, problemsRoot: cfg.problemsRoot, spawnAudio: cfg.spawnAudio });

  return server;
}
