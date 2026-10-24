import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Category, Difficulty as DifficultySchema, Tier as TierSchema, type Problem } from "@lci/core";
import { loadEntries } from "./gates.ts";

// core は Difficulty / Tier を zod 値としてしか export していないので型だけここで導出する
type Difficulty = z.infer<typeof DifficultySchema>;
type Tier = z.infer<typeof TierSchema>;
const Difficulty = DifficultySchema;
const Tier = TierSchema;
import { catalogDir } from "./paths.ts";
import { renderTable } from "./report.ts";

/** problems/_catalog/targets.json（04 §2.2 の表） */
export const Targets = z.object({
  total: z.number().int(),
  categories: z.record(
    Category,
    z.object({
      label: z.string(),
      total: z.number().int(),
      by_difficulty: z.record(Difficulty, z.number().int()),
      time_limits: z.array(z.number().int()),
      languages: z.array(z.string()),
    }),
  ),
});
export type Targets = z.infer<typeof Targets>;

export const Seed = z.object({
  id: z.string().regex(/^[a-z]+-\d{4}$/),
  category: Category,
  difficulty: Difficulty,
  time_limit: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45)]),
  title: z.string().min(1),
  one_line: z.string().min(1),
  nfr: z.array(z.string()),
  languages_planned: z.array(z.string()).min(1),
  company_style: z.enum(["pixiv", "m3", "generic"]),
  status: z.enum(["seed", "core", "generated"]),
});
export type Seed = z.infer<typeof Seed>;

export const CATEGORIES = Category.options;
export const DIFFICULTIES = Difficulty.options;
export const TIERS = Tier.options;

export async function readTargets(root: string): Promise<Targets> {
  const raw = await fs.readFile(path.join(catalogDir(root), "targets.json"), "utf8");
  return Targets.parse(JSON.parse(raw));
}

export async function readSeeds(root: string): Promise<Seed[] | null> {
  try {
    const raw = await fs.readFile(path.join(catalogDir(root), "seeds.json"), "utf8");
    return z.array(Seed).parse(JSON.parse(raw));
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ENOENT") return null;
    throw e;
  }
}

export interface Stats {
  problems: number;
  unloadable: number;
  byCategory: Record<Category, { total: number; byDifficulty: Record<Difficulty, number>; byTier: Record<Tier, number> }>;
  byTier: Record<Tier, number>;
  seeds: Record<Category, { seed: number; core: number; generated: number }> | null;
}

function emptyCat() {
  return {
    total: 0,
    byDifficulty: { L1: 0, L2: 0, L3: 0, L4: 0 } as Record<Difficulty, number>,
    byTier: { core: 0, generated: 0, draft: 0 } as Record<Tier, number>,
  };
}

export function computeStats(problems: Problem[], seeds: Seed[] | null, unloadable = 0): Stats {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, emptyCat()])) as Stats["byCategory"];
  const byTier: Record<Tier, number> = { core: 0, generated: 0, draft: 0 };
  for (const p of problems) {
    const c = byCategory[p.meta.category];
    c.total++;
    c.byDifficulty[p.meta.difficulty]++;
    c.byTier[p.meta.tier]++;
    byTier[p.meta.tier]++;
  }
  let seedStats: Stats["seeds"] = null;
  if (seeds) {
    seedStats = Object.fromEntries(CATEGORIES.map((c) => [c, { seed: 0, core: 0, generated: 0 }])) as NonNullable<Stats["seeds"]>;
    for (const s of seeds) seedStats[s.category][s.status]++;
  }
  return { problems: problems.length, unloadable, byCategory, byTier, seeds: seedStats };
}

export function formatStats(stats: Stats, targets: Targets): string {
  const rows: string[][] = [];
  const pair = (): [number, number] => [0, 0];
  const tot = { target: 0, total: 0, core: 0, generated: 0, draft: 0, L1: pair(), L2: pair(), L3: pair(), L4: pair() };
  for (const c of CATEGORIES) {
    const t = targets.categories[c];
    const s = stats.byCategory[c];
    const cell = (d: Difficulty) => `${s.byDifficulty[d]}/${t?.by_difficulty[d] ?? 0}`;
    rows.push([
      c,
      t?.label ?? "",
      String(t?.total ?? 0),
      String(s.total),
      String(s.byTier.core),
      String(s.byTier.generated),
      String(s.byTier.draft),
      cell("L1"),
      cell("L2"),
      cell("L3"),
      cell("L4"),
      stats.seeds ? `${stats.seeds[c].seed + stats.seeds[c].core + stats.seeds[c].generated}` : "-",
    ]);
    tot.target += t?.total ?? 0;
    tot.total += s.total;
    tot.core += s.byTier.core;
    tot.generated += s.byTier.generated;
    tot.draft += s.byTier.draft;
    for (const d of DIFFICULTIES) {
      tot[d][0] += s.byDifficulty[d];
      tot[d][1] += t?.by_difficulty[d] ?? 0;
    }
  }
  rows.push([
    "合計",
    "",
    String(tot.target),
    String(stats.problems),
    String(tot.core),
    String(tot.generated),
    String(tot.draft),
    `${tot.L1[0]}/${tot.L1[1]}`,
    `${tot.L2[0]}/${tot.L2[1]}`,
    `${tot.L3[0]}/${tot.L3[1]}`,
    `${tot.L4[0]}/${tot.L4[1]}`,
    stats.seeds ? String(Object.values(stats.seeds).reduce((a, s) => a + s.seed + s.core + s.generated, 0)) : "-",
  ]);
  const out = [
    renderTable(["cat", "カテゴリ", "目標", "現在", "core", "gen", "draft", "L1", "L2", "L3", "L4", "seeds"], rows, ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"]),
    "",
    `現在 ${stats.problems} 問（core ${stats.byTier.core} / generated ${stats.byTier.generated} / draft ${stats.byTier.draft}）。目標 ${targets.total} 問に対し ${((stats.problems / targets.total) * 100).toFixed(1)}%`,
  ];
  if (stats.unloadable) out.push(`読み込めなかった問題ディレクトリ: ${stats.unloadable}（problems:validate で確認）`);
  if (!stats.seeds) out.push("seeds.json が無い（pnpm --filter @lci/problem-tools make-seeds で生成）");
  return out.join("\n");
}

export async function runStats(root: string): Promise<number> {
  const [entries, targets, seeds] = await Promise.all([loadEntries(root), readTargets(root), readSeeds(root)]);
  const problems = entries.flatMap((e) => (e.problem ? [e.problem] : []));
  const stats = computeStats(problems, seeds, entries.length - problems.length);
  console.log(formatStats(stats, targets));
  return 0;
}
