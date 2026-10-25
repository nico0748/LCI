import { createHash } from "node:crypto";
import type { Problem } from "@lci/core";
import type { Runner } from "@lci/runner";
import { DEMO_SCHEMA_VERSION, GUIDE_VERSION, type DemoScript } from "./schema.ts";
import type { AudioJobStatus, DemoDetail, DemoRevisionInfo, DemoSummary } from "./types.ts";
import { compileDemo } from "./compile.ts";
import { DemoStore, type DemoIndex } from "./store.ts";
import { demoFileFor, findProblemById } from "./problem.ts";
import { activeRecordings, validateDemoDraft, warningStrings, type ValidateInput, type ValidationReport } from "./validate.ts";
import { resolveEngine, type EngineResolution } from "./tts/engines.ts";
import { AudioBusyError, audioStatusOf, calibratedReadingCps, synthesizeDemo } from "./tts/synth.ts";

/**
 * デモの操作をまとめた窓口。MCP サーバ（packages/mcp-server）と Next の Route Handler（apps/web/src/lib/demo）が
 * 同じものを使う（02 結論 8）。録画中の 409（D15）とネタバレの reveal（D14）の判定は呼び出し側の HTTP / MCP 層で行う。
 */

export interface DemoServiceConfig {
  dataRoot: string;
  problemsRoot: string;
  env?: NodeJS.ProcessEnv;
  /** 検証に使うランナー（省略時は @lci/runner の getRunner()） */
  runner?: () => Runner;
}

export interface SaveInput extends ValidateInput {
  demo_id?: string;
  note?: string;
  model?: string;
  route?: "mcp" | "in_app_api";
  prompt_hash?: string;
}

export type SaveResult =
  | { ok: false; report: ValidationReport }
  | { ok: true; report: ValidationReport; demo_id: string; revision: number; url: string; script: DemoScript };

export function demoUrl(problemId: string, language: string, demoId: string): string {
  return `/problems/${encodeURIComponent(problemId)}/demo?lang=${encodeURIComponent(language)}&demo=${encodeURIComponent(demoId)}`;
}

export function audioUrlTemplate(demoId: string): string {
  return `/api/demos/${demoId}/audio/{key}?reveal=1`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export class DemoService {
  readonly store: DemoStore;
  readonly cfg: DemoServiceConfig;
  private engineCache: { at: number; value: EngineResolution } | null = null;

  constructor(cfg: DemoServiceConfig) {
    this.cfg = cfg;
    this.store = new DemoStore(cfg.dataRoot);
  }

  private get env(): NodeJS.ProcessEnv {
    return this.cfg.env ?? process.env;
  }

  /** 録画中のセッション id（D15。空なら録画していない） */
  busy(): Promise<string[]> {
    return activeRecordings(this.cfg.dataRoot);
  }

  /** 音声エンジンの有無（which だけなので軽い。30 秒キャッシュ） */
  async engine(): Promise<EngineResolution> {
    if (this.engineCache && Date.now() - this.engineCache.at < 30_000) return this.engineCache.value;
    const value = await resolveEngine(this.env);
    this.engineCache = { at: Date.now(), value };
    return value;
  }

  async validate(input: ValidateInput): Promise<ValidationReport> {
    const readingCps = await calibratedReadingCps(this.cfg.dataRoot, this.env);
    return (await validateDemoDraft(input, { problemsRoot: this.cfg.problemsRoot, dataRoot: this.cfg.dataRoot, runner: this.cfg.runner?.(), env: this.env, readingCps })).report;
  }

  /** 検証して、通れば新しい版として保存する（D8: 検証を通らない版は保存しない） */
  async save(input: SaveInput): Promise<SaveResult> {
    const readingCps = await calibratedReadingCps(this.cfg.dataRoot, this.env);
    const { report, validated: v } = await validateDemoDraft(input, { problemsRoot: this.cfg.problemsRoot, dataRoot: this.cfg.dataRoot, runner: this.cfg.runner?.(), env: this.env, readingCps });
    if (!report.ok || !v) return { ok: false, report };
    const { script } = await this.store.saveRevision({ problem_id: v.problem.meta.id, language: v.language, demo_id: input.demo_id }, ({ demo_id, revision, created_at }) => ({
      schema_version: DEMO_SCHEMA_VERSION,
      demo_id,
      revision,
      problem: { id: v.problem.meta.id, dir: v.problem.dir, title: v.problem.meta.title, judge_kind: v.problem.tests.kind as "stdio" | "unit" },
      language: v.language,
      file: v.file,
      created_at,
      author: { route: input.route ?? "mcp", model: input.model?.slice(0, 80) || "mcp-client", guide_version: GUIDE_VERSION, ...(input.prompt_hash ? { prompt_hash: input.prompt_hash } : {}) },
      draft: v.draft,
      validation: {
        validated_at: created_at,
        runner_backend: v.runner_backend,
        final_sha256: v.final_sha256,
        final_judge: v.final_judge,
        runs: v.runs,
        estimate_ms: v.estimate_ms,
        warnings: warningStrings(v.warnings),
        self_metrics: v.self_metrics,
      },
      digest: v.digest,
      ...(input.note ? { note: input.note.slice(0, 500) } : {}),
    }));
    return { ok: true, report, demo_id: script.demo_id, revision: script.revision, url: demoUrl(script.problem.id, script.language, script.demo_id), script };
  }

  private problemCache = new Map<string, { at: number; p: Problem | null }>();
  private async problem(id: string): Promise<Problem | null> {
    const c = this.problemCache.get(id);
    if (c && Date.now() - c.at < 10_000) return c.p;
    const p = await findProblemById(this.cfg.problemsRoot, id).catch(() => null);
    this.problemCache.set(id, { at: Date.now(), p });
    return p;
  }

  private async summaryOf(idx: DemoIndex, revision?: number): Promise<DemoSummary | null> {
    const rev = idx.revisions.find((r) => r.revision === (revision ?? idx.current_revision)) ?? idx.revisions[idx.revisions.length - 1];
    if (!rev) return null;
    const engine = await this.engine();
    const st = await audioStatusOf(this.store, idx.demo_id, rev.revision, { engineAvailable: !!engine.engine });
    const p = await this.problem(idx.problem_id);
    const starterSha = p ? sha256(demoFileFor(p, idx.language).content) : null;
    return {
      demo_id: idx.demo_id,
      revision: rev.revision,
      problem_id: idx.problem_id,
      language: idx.language,
      title: rev.title,
      created_at: rev.created_at,
      author_model: rev.author_model,
      final_verdict: rev.final_verdict,
      passed: rev.passed,
      total: rev.total,
      estimate_ms: rev.estimate_ms,
      audio_status: st.status,
      audio_bytes: st.manifest ? st.manifest.total_bytes : null,
      revisions_count: idx.revisions.length,
      problem_updated: starterSha !== null && starterSha !== rev.base_sha256,
      runner_backend: rev.runner_backend,
    };
  }

  /** GET /api/demos?problem= ・ list_demos（新しい順。中身は含めない） */
  async summaries(filter: { problem_id?: string; language?: string } = {}): Promise<DemoSummary[]> {
    const out: DemoSummary[] = [];
    for (const idx of await this.store.list(filter)) {
      const s = await this.summaryOf(idx);
      if (s) out.push(s);
    }
    return out;
  }

  async revisions(demoId: string): Promise<DemoRevisionInfo[] | null> {
    const idx = await this.store.index(demoId);
    if (!idx) return null;
    return [...idx.revisions].reverse().map((r) => ({ revision: r.revision, created_at: r.created_at, title: r.title, final_verdict: r.final_verdict, passed: r.passed, total: r.total, estimate_ms: r.estimate_ms, ...(r.note ? { note: r.note } : {}) }));
  }

  /** GET /api/demos/<id>?reveal=1（呼び出し側で reveal を確認すること） */
  async detail(demoId: string, revision?: number): Promise<DemoDetail | null> {
    const idx = await this.store.index(demoId);
    if (!idx) return null;
    const script = await this.store.getScript(demoId, revision);
    if (!script) return null;
    const summary = await this.summaryOf(idx, script.revision);
    if (!summary) return null;
    const manifest = await this.store.readManifest(demoId, script.revision);
    let initial: string | undefined;
    if (script.file.base_text === undefined) {
      const p = await this.problem(script.problem.id);
      initial = p ? demoFileFor(p, script.language).content : "";
    }
    const compiled = compileDemo(script, manifest, initial);
    const engine = await this.engine();
    const st = await audioStatusOf(this.store, demoId, script.revision, { engineAvailable: !!engine.engine });
    const detail: DemoDetail = {
      summary,
      script,
      compiled,
      audio: manifest,
      audio_url_template: audioUrlTemplate(demoId),
      revisions: (await this.revisions(demoId)) ?? [],
    };
    if (st.status === "generating") detail.audio_progress = { done: st.done, total: st.total };
    if (!manifest && !engine.engine) detail.audio_unavailable_reason = engine.reason;
    if (!manifest && st.status === "failed" && st.error) detail.audio_unavailable_reason = `音声の合成に失敗しました: ${st.error}`;
    return detail;
  }

  async remove(demoId: string, opts: { revision?: number; audioOnly?: boolean } = {}) {
    return this.store.remove(demoId, opts);
  }

  async audioStatus(demoId: string, revision?: number): Promise<AudioJobStatus | null> {
    const idx = await this.store.index(demoId);
    if (!idx) return null;
    const rev = revision ?? idx.current_revision;
    const engine = await this.engine();
    const { manifest: _manifest, ...st } = await audioStatusOf(this.store, demoId, rev, { engineAvailable: !!engine.engine });
    return st;
  }

  /**
   * 音声合成を（この プロセスで、待たずに）始める。POST /api/demos/<id>/audio。
   * 返り値: started / generating（すでに合成中）/ ready（すでにある）/ unavailable（エンジンが無い）
   */
  async startAudio(demoId: string, opts: { revision?: number; force?: boolean; log?: (m: string) => void } = {}): Promise<{ status: "started" | "generating" | "ready" | "unavailable" | "not_found"; reason?: string; total?: number; revision?: number }> {
    const idx = await this.store.index(demoId);
    if (!idx) return { status: "not_found" };
    const rev = opts.revision ?? idx.current_revision;
    if (!idx.revisions.some((r) => r.revision === rev)) return { status: "not_found" };
    const engine = await this.engine();
    if (!engine.engine) return { status: "unavailable", reason: engine.reason, revision: rev };
    const st = await audioStatusOf(this.store, demoId, rev, { engineAvailable: true });
    if (st.status === "generating") return { status: "generating", total: st.total, revision: rev };
    if (st.status === "ready" && !opts.force) return { status: "ready", total: st.total, revision: rev };
    const script = await this.store.getScript(demoId, rev);
    const total = script?.draft.steps.filter((s) => s.say).length ?? 0;
    const log = opts.log ?? ((m: string) => console.error(m));
    synthesizeDemo(this.store, demoId, { revision: rev, force: opts.force, env: this.env, log, waitMs: 10 * 60_000 }).catch((e) => {
      if (!(e instanceof AudioBusyError)) log(`[demo-tts] ${demoId} rev${rev} 失敗: ${(e as Error).message}`);
    });
    return { status: "started", total, revision: rev };
  }
}
