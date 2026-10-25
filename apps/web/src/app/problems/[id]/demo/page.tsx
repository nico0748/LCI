import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Language, Metrics, Problem } from "@lci/core";
import { problem, store } from "@/lib/server";
import { PROBLEMS_ROOT } from "@/lib/paths";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { DemoPageClient } from "@/components/demo/client";
import type { DemoProblemInfo, DemoUserRecord } from "@/components/demo/types";
import { loadBrowseData } from "../../browse-data.ts";
import { buildRecords } from "../../browse-model.ts";

export const dynamic = "force-dynamic";

/**
 * 模範解答デモ（docs/requirements/demo/01_ux.md、00_decisions.md D13）。`/problems/[id]/demo?lang=&demo=&rev=&chapter=`（rev は 01 の `v=` でも受ける）。
 * サーバでは問題の公開部分と、ゲート（FR-D-04）の判定に使う自分の記録だけを読む。
 * デモの一覧・本体・音声はクライアントが /api/demos から取る（本体は reveal=1 が要る。ゲートを通った後だけ取る）。
 */
export default async function DemoRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await problem(id);
  if (!p) notFound();

  const { sessions } = await loadBrowseData();
  // ゲートの判定は問題詳細と同じ buildRecords（終了済みのセッションだけを数える。FR-D-04）
  const rec = buildRecords(sessions).get(p.meta.id);
  const latest = rec ? (sessions.find((s) => s.session_id === rec.lastSessionId) ?? null) : null;
  const latestMetrics = latest ? await store().getMetrics<Metrics>(latest.session_id).catch(() => null) : null;
  const record: DemoUserRecord = {
    finished: rec?.attempts ?? 0,
    latestSessionId: latest?.session_id ?? null,
    latestLanguage: (latest?.problem.language as Language | undefined) ?? null,
    latestMetrics,
    latestDurationMs: latest?.durationMs ?? null,
  };

  const info: DemoProblemInfo = {
    id: p.meta.id,
    title: p.meta.title,
    time_limit: p.meta.time_limit,
    languages: p.meta.languages,
    judge_kind: p.tests.kind,
    statement: p.body.statement,
    constraints: p.body.constraints,
    talking_points: p.meta.talking_points,
    requirements: p.meta.requirements,
    samples: await readSamples(p.dir, p.tests),
  };

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const toRev = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);
  return (
    <PageContainer as="main" width="full">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col">
        <DemoPageClient problem={info} record={record} initialLang={one(sp.lang)} initialDemoId={one(sp.demo)} initialChapter={one(sp.chapter)} initialRevision={toRev(one(sp.rev) ?? one(sp.v))} />
      </div>
    </PageContainer>
  );
}

/** 公開のサンプルだけを読む（問題ディレクトリの外は読まない） */
async function readSamples(dir: string, tests: Problem["tests"]): Promise<DemoProblemInfo["samples"]> {
  if (tests.kind !== "stdio") return [];
  const root = path.resolve(PROBLEMS_ROOT, dir);
  const read = async (rel: string | undefined, inline: string | undefined) => {
    if (inline != null) return inline;
    if (!rel) return "";
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) return "";
    return fs.readFile(abs, "utf8").catch(() => "");
  };
  const out: DemoProblemInfo["samples"] = [];
  for (const c of tests.cases) {
    if (c.visibility !== "sample") continue;
    out.push({ name: c.name, stdin: await read(c.stdinFile, c.stdin), expected: await read(c.expectedFile, c.expected) });
  }
  return out;
}
