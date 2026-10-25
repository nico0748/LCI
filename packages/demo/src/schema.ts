import { z } from "zod";
import { Axis, Language, Verdict } from "@lci/core/browser";

/**
 * 模範解答デモの台本（docs/requirements/demo/00_decisions.md）。
 * Claude が書くのは DemoDraft（内容だけ。位置・時刻は書かない）。
 * アプリが検証してメタと実行結果を足したものが DemoScript（保存形）。
 */

export const DEMO_SCHEMA_VERSION = "1.0";
export const GUIDE_VERSION = "2026.10-a";
export const LIMITS = {
  scriptBytes: 256 * 1024,
  steps: 60,
  chapters: 12,
  opsPerStep: 12,
  opText: 6_000,
  sayPerStep: 320,
  sayTotal: 7_000,
  readingFactor: 2,
  fileBytes: 64 * 1024,
  glossary: 60,
} as const;

/** step / chapter の id。安定アンカー（再コンパイルで時刻が動いても参照が壊れない） */
export const LocalId = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/, "英小文字始まり、英小文字・数字・_- の 32 文字以内");

/** text は字幕（インライン `code` のみ可）。reading は音声合成に渡す読み（省略時は辞書で自動生成） */
export const Say = z.object({
  text: z.string().min(1).max(LIMITS.sayPerStep),
  reading: z.string().min(1).max(LIMITS.sayPerStep * LIMITS.readingFactor).optional(),
});
export type Say = z.infer<typeof Say>;

const Pace = z.enum(["type", "fast", "instant"]).default("type");

/** 位置は書かない。replace の old は現在のファイル内でちょうど 1 回だけ一致すること */
export const CodeOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("replace"), old: z.string().min(1).max(LIMITS.opText), new: z.string().max(LIMITS.opText), pace: Pace }),
  z.object({ op: z.literal("append"), text: z.string().min(1).max(LIMITS.opText), pace: Pace }),
  z.object({ op: z.literal("write"), content: z.string().max(LIMITS.fileBytes), pace: Pace }),
]);
export type CodeOp = z.infer<typeof CodeOp>;

/** 実行の演出。結果は保存時に実際に実行して記録したものを再生する（再生時に Docker は不要） */
export const RunAction = z.object({
  /** sample=サンプルケース, stdin=任意入力, judge=全ケース */
  mode: z.enum(["sample", "stdin", "judge"]),
  stdin: z.string().max(4_000).optional(),
  /** 意図的に WA を見せる演出（寄り道）は expect に WA などを書く */
  expect: z.union([Verdict, z.literal("any")]).default("AC"),
  /**
   * 追加（demo-backend）: mode=stdin で予告した出力。書くとトークン比較で AC / WA を判定する
   * （書かなければ正常終了で AC）。「〜が出るはずです」と予告してから実行する手本（R5）を検証できるようにする
   */
  expect_output: z.string().max(1_000).optional(),
});
export type RunAction = z.infer<typeof RunAction>;

export const Step = z.object({
  id: LocalId,
  chapter: LocalId,
  say: Say.optional(),
  code: z.array(CodeOp).max(LIMITS.opsPerStep).default([]),
  /** with=最初の文を言い終えたら打ち始める（既定） / after=言い終えてから / before=打ちながら話す */
  code_timing: z.enum(["with", "after", "before"]).default("with"),
  run: RunAction.optional(),
  /** 説明中に強調する範囲（現在のファイル内で一意一致） */
  highlight: z.object({ find: z.string().min(1).max(400) }).optional(),
  /** このステップで触れる talking_points / requirements の id */
  covers: z.array(z.string().max(40)).max(8).default([]),
  pause_after_ms: z.number().int().min(0).max(3_000).optional(),
});
export type Step = z.infer<typeof Step>;

/** 章は固定の語彙（phase）を持ち、手本になるルーブリック軸に対応する */
export const ChapterPhase = z.enum(["requirements", "plan", "implement", "test", "detour", "review"]);
export type ChapterPhase = z.infer<typeof ChapterPhase>;

export const Chapter = z.object({
  id: LocalId,
  title: z.string().min(1).max(40),
  phase: ChapterPhase,
  axes: z.array(Axis).max(3).default([]),
});
export type Chapter = z.infer<typeof Chapter>;

/** Claude が書く部分（MCP 入力）。メタや時刻は含めない。横断チェックは validate で行う */
export const DemoDraft = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(300),
  target_minutes: z.number().min(3).max(20).optional(),
  chapters: z.array(Chapter).min(2).max(LIMITS.chapters),
  steps: z.array(Step).min(3).max(LIMITS.steps),
  glossary: z.array(z.object({ term: z.string().min(1).max(40), reading: z.string().min(1).max(80) })).max(LIMITS.glossary).default([]),
  /** 参照解との違い・この解法の弱点の自己申告 */
  self_check: z.string().max(600),
});
export type DemoDraft = z.infer<typeof DemoDraft>;

export const DEMO_ID_RE = /^d_\d{8}T\d{6}_[a-z0-9]{4}$/;
export const DemoId = z.string().regex(DEMO_ID_RE);

export const RunSnapshot = z.object({
  verdict: Verdict,
  duration_ms: z.number(),
  passed: z.number().int(),
  total: z.number().int(),
  cases: z
    .array(
      z.object({
        name: z.string(),
        verdict: Verdict,
        stdout_head: z.string().max(1_024).optional(),
        expected_head: z.string().max(1_024).optional(),
        /** 追加（demo-backend）: サンプルケースの入力の先頭（プレイヤーの「入力」欄用。hidden は入れない） */
        stdin_head: z.string().max(1_024).optional(),
        /** 追加（demo-backend）: WA の差分・RE の理由など（runner の CaseResult.message の先頭） */
        message: z.string().max(400).optional(),
      }),
    )
    .max(20),
  stdout_head: z.string().max(2_048).optional(),
  stderr_head: z.string().max(2_048).optional(),
});
export type RunSnapshot = z.infer<typeof RunSnapshot>;

/** 保存形。アプリがメタ・検証結果を埋める */
export const DemoScript = z.object({
  schema_version: z.literal(DEMO_SCHEMA_VERSION),
  demo_id: DemoId,
  revision: z.number().int().min(1),
  problem: z.object({ id: z.string(), dir: z.string(), title: z.string(), judge_kind: z.enum(["stdio", "unit", "web"]) }),
  language: Language,
  file: z.object({
    path: z.string(),
    base: z.enum(["starter", "empty"]),
    base_sha256: z.string(),
    /** 追加（demo-backend）: 基底テキスト（starter の全文、empty なら ""）。台本だけで再コンパイルできるようにする */
    base_text: z.string().max(LIMITS.fileBytes).optional(),
  }),
  created_at: z.string(),
  author: z.object({
    route: z.enum(["mcp", "in_app_api"]),
    model: z.string(),
    guide_version: z.string(),
    prompt_hash: z.string().optional(),
  }),
  draft: DemoDraft,
  validation: z.object({
    validated_at: z.string(),
    runner_backend: z.enum(["docker", "fake"]),
    final_sha256: z.string(),
    final_judge: RunSnapshot,
    /** step_id → 実行結果 */
    runs: z.record(z.string(), RunSnapshot),
    estimate_ms: z.number().int(),
    warnings: z.array(z.string()).max(50),
    self_metrics: z.object({
      silent_typing_max_s: z.number(),
      silent_edit_ratio: z.number(),
      lead_time_median_s: z.number().nullable(),
    }),
  }),
  /** sha256(正規化 draft + base)。音声キャッシュの鍵 */
  digest: z.string(),
  /** 追加（demo-backend）: save_demo_script の note（作り直しの理由など） */
  note: z.string().max(500).optional(),
});
export type DemoScript = z.infer<typeof DemoScript>;

/** 音声キャッシュ。区間ファイル名は内容ハッシュなので、変わった区間だけ作り直せる */
export const AudioManifest = z.object({
  engine: z.enum(["say", "fake", "voicevox", "cloud"]),
  voice: z.string(),
  rate: z.number(),
  format: z.enum(["m4a", "webm"]),
  engine_info: z.string().optional(),
  segments: z.array(
    z.object({
      step_id: LocalId,
      key: z.string().regex(/^[a-f0-9]{16}$/),
      duration_ms: z.number().int().positive(),
      bytes: z.number().int(),
    }),
  ),
  total_bytes: z.number().int(),
  generated_at: z.string(),
});
export type AudioManifest = z.infer<typeof AudioManifest>;
