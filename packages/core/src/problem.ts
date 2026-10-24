import { z } from "zod";

/**
 * 問題バンクのスキーマ。
 * - メタデータと本文: problems/<CAT>/<id-slug>/problem.md（YAML frontmatter）
 * - 実行・判定定義:   同ディレクトリの tests.json（kind: stdio | unit | web）
 * 要件書 04 §3 と 02 §問題テスト定義スキーマ を統合したもの。
 */

export const Category = z.enum(["FE", "BE", "DATA", "ALG", "SQL", "SEC", "DBG", "SYS", "LOW"]);
export type Category = z.infer<typeof Category>;

export const CATEGORY_LABEL: Record<Category, string> = {
  FE: "フロント小機能実装",
  BE: "バックエンド・API",
  DATA: "業務データ処理",
  ALG: "アルゴリズム・データ構造",
  SQL: "SQL",
  SEC: "セキュリティ意識実装",
  DBG: "デバッグ・リファクタリング",
  SYS: "システム設計スケッチ",
  LOW: "低レイヤ・メモリ安全",
};

export const Language = z.enum(["c", "rust", "python", "go", "typescript", "javascript", "html", "php", "sql", "markdown"]);
export type Language = z.infer<typeof Language>;

export const LANGUAGE_LABEL: Record<Language, string> = {
  c: "C",
  rust: "Rust",
  python: "Python",
  go: "Go",
  typescript: "TypeScript",
  javascript: "JavaScript",
  html: "HTML/CSS/JS",
  php: "PHP",
  sql: "SQL",
  markdown: "Markdown",
};

export const Tier = z.enum(["core", "generated", "draft"]);
export const Difficulty = z.enum(["L1", "L2", "L3", "L4"]);
export const TimeLimit = z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45)]);
export const InterviewerMode = z.enum(["silent", "followup"]);

export const TalkingPoint = z.object({
  id: z.string(),
  text: z.string(),
  weight: z.number().int().min(1).max(5).default(1),
});

export const StarterFile = z.object({
  path: z.string(),
  language: Language,
  /** 相対パス（problem ディレクトリ基準）。未指定なら content を使う */
  content_ref: z.string().optional(),
  content: z.string().optional(),
});

export const FollowupPrompt = z.object({
  /** 経過秒で発火。silence_sec と併用可 */
  at_sec: z.number().int().optional(),
  /** この秒数以上の沈黙で発火 */
  silence_sec: z.number().int().optional(),
  text: z.string(),
});

export const ProblemMeta = z.object({
  id: z.string().regex(/^[a-z]+-\d{4}$/, "id は fe-0001 形式"),
  slug: z.string(),
  title: z.string(),
  category: Category,
  tier: Tier.default("draft"),
  difficulty: Difficulty,
  time_limit: TimeLimit,
  languages: z.array(Language).min(1),
  tags: z
    .object({
      company_style: z.array(z.string()).default([]),
      nfr: z.array(z.string()).default([]),
      security: z.array(z.string()).default([]),
      talk_focus: z.array(z.string()).default([]),
    })
    .default({ company_style: [], nfr: [], security: [], talk_focus: [] }),
  interviewer_mode: InterviewerMode.default("silent"),
  followups: z.array(FollowupPrompt).default([]),
  web_search: z.boolean().default(false),
  allow_questions: z.boolean().default(true),
  starter_files: z.array(StarterFile).default([]),
  talking_points: z.array(TalkingPoint).default([]),
  requirements: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .default([])
    .describe("評価時の要件チェックリスト（実装手段ではなく要件として書く）"),
  rubric_hints: z
    .object({
      correctness: z.string().optional(),
      explanation: z.string().optional(),
      time_management: z.string().optional(),
      red_flags: z.array(z.string()).default([]),
      checklist: z.array(z.string()).default([]),
    })
    .default({ red_flags: [], checklist: [] }),
  reference_solutions: z.record(z.string(), z.string()).default({}),
  source: z.object({ origin: z.string().optional(), license: z.string().optional() }).default({}),
  review: z
    .object({
      reviewed_by: z.enum(["human", "llm", "none"]).default("none"),
      reviewed_at: z.string().optional(),
      known_issues: z.array(z.string()).default([]),
    })
    .default({ reviewed_by: "none", known_issues: [] }),
});
export type ProblemMeta = z.infer<typeof ProblemMeta>;

/** problem.md 本文を見出しで分割したもの */
export const ProblemBody = z.object({
  statement: z.string(),
  constraints: z.string().default(""),
  interviewer_notes: z.string().default(""),
  review_notes: z.string().default(""),
});
export type ProblemBody = z.infer<typeof ProblemBody>;

// ---- tests.json -----------------------------------------------------------

export const Limits = z.object({
  timeMs: z.number().int().positive().optional(),
  wallMs: z.number().int().positive().optional(),
  memoryMb: z.number().int().positive().optional(),
  outputKb: z.number().int().positive().optional(),
});

export const StdioCase = z.object({
  name: z.string(),
  visibility: z.enum(["sample", "hidden"]).default("hidden"),
  stdin: z.string().optional(),
  stdinFile: z.string().optional(),
  expected: z.string().optional(),
  expectedFile: z.string().optional(),
  limits: Limits.optional(),
});

export const StdioTests = z.object({
  kind: z.literal("stdio"),
  limits: Limits.default({}),
  compare: z
    .object({
      mode: z.enum(["exact", "token", "float"]).default("token"),
      floatAbs: z.number().optional(),
      floatRel: z.number().optional(),
    })
    .default({ mode: "token" }),
  cases: z.array(StdioCase).min(1),
});

export const UnitTests = z.object({
  kind: z.literal("unit"),
  limits: Limits.default({}),
  harness: z.record(
    z.string(),
    z.object({ files: z.array(z.string()), command: z.string(), resultParser: z.string().optional() }),
  ),
  userEntry: z.record(z.string(), z.string()),
});

export const WebStep = z.union([
  z.object({ type: z.string(), value: z.string() }),
  z.object({ click: z.string(), times: z.number().int().optional(), intervalMs: z.number().int().optional() }),
  z.object({ wait: z.number().int() }),
  z.object({ waitForRequestsSettled: z.number().int() }),
  z.object({ expectText: z.object({ selector: z.string(), contains: z.array(z.string()) }) }),
  z.object({ expectNoText: z.object({ selector: z.string(), contains: z.array(z.string()) }) }),
  z.object({
    expectRequests: z.object({
      count: z.number().int().optional(),
      completedMax: z.number().int().optional(),
      url: z.string().optional(),
      allowAborted: z.boolean().optional(),
    }),
  }),
]);

export const WebTests = z.object({
  kind: z.literal("web"),
  preview: z
    .object({
      tailwind: z.enum(["local", "none"]).default("local"),
      viewport: z.object({ width: z.number().int(), height: z.number().int() }).default({ width: 800, height: 600 }),
    })
    .default({ tailwind: "local", viewport: { width: 800, height: 600 } }),
  mockApi: z
    .object({
      routes: z.array(
        z.object({
          match: z.object({ method: z.string().default("GET"), urlPattern: z.string() }),
          latencyMs: z.tuple([z.number(), z.number()]).default([200, 500]),
          failRate: z.number().min(0).max(1).default(0),
          respond: z.object({
            byQuery: z.record(z.string(), z.unknown()).default({}),
            default: z.unknown(),
          }),
        }),
      ),
      unmatched: z.enum(["block", "passthrough"]).default("block"),
    })
    .optional(),
  layout: z
    .array(z.object({ name: z.string(), assert: z.enum(["sameRow", "below", "exists"]), selectors: z.array(z.string()) }))
    .default([]),
  scenarios: z.array(
    z.object({
      name: z.string(),
      steps: z.array(WebStep),
      tags: z.array(z.string()).default([]),
      weight: z.number().default(1),
    }),
  ),
  rubricHints: z.array(z.string()).default([]),
});

export const SysTests = z.object({ kind: z.literal("none") });

export const ProblemTests = z.discriminatedUnion("kind", [StdioTests, UnitTests, WebTests, SysTests]);
export type ProblemTests = z.infer<typeof ProblemTests>;

export const Problem = z.object({
  meta: ProblemMeta,
  body: ProblemBody,
  tests: ProblemTests,
  /** problems/ からの相対ディレクトリ */
  dir: z.string(),
});
export type Problem = z.infer<typeof Problem>;

/** 一覧表示用の軽量版 */
export const ProblemSummary = ProblemMeta.pick({
  id: true,
  slug: true,
  title: true,
  category: true,
  tier: true,
  difficulty: true,
  time_limit: true,
  languages: true,
  tags: true,
}).extend({ dir: z.string(), kind: z.enum(["stdio", "unit", "web", "none"]) });
export type ProblemSummary = z.infer<typeof ProblemSummary>;
