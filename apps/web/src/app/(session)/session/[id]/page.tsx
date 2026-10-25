import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { PROBLEMS_ROOT } from "@/lib/paths";
import { problem, store } from "@/lib/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState, LinkButton } from "@/components/ui";
import { InterviewScreenClient as InterviewScreen } from "@/components/session/client";
import type { InterviewData } from "@/components/session/types";

export const dynamic = "force-dynamic";

/** 公開サンプルの標準入力（stdin か stdinFile）。問題フォルダの外は読まない */
async function sampleStdin(dir: string, c: { stdin?: string; stdinFile?: string } | undefined): Promise<string> {
  if (!c) return "";
  if (c.stdin !== undefined) return c.stdin;
  if (!c.stdinFile) return "";
  const base = path.resolve(PROBLEMS_ROOT, dir);
  const file = path.resolve(base, c.stdinFile);
  if (!file.startsWith(base + path.sep)) return "";
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

/** S3 面接セッション画面 */
export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await store().get(id);
  if (!session) notFound();
  if (session.status !== "preparing" && session.status !== "recording") {
    return (
      <PageContainer as="main" width="reading">
        <h1 className="sr-only">このセッションは終了しています</h1>
        <EmptyState
          title="このセッションは終了しています"
          description="終了したセッションは再開できません。録画と記録は振り返り画面で確認できます。"
          action={
            <LinkButton href={`/sessions/${encodeURIComponent(id)}`} variant="primary">
              振り返りを開く
            </LinkButton>
          }
        />
      </PageContainer>
    );
  }
  const p = await problem(session.problem.id);
  if (!p) notFound();

  const starters = p.meta.starter_files;
  const files = session.files.map((f) => ({
    fileId: f.file_id,
    path: f.path,
    language: f.language,
    initial: starters.find((s) => s.path === f.path)?.content ?? "",
  }));
  const mode = sp.mode === "followup" || sp.mode === "silent" ? sp.mode : p.meta.interviewer_mode;
  const tests = p.tests;
  const data: InterviewData = {
    sessionId: session.session_id,
    status: session.status,
    problemId: p.meta.id,
    title: p.meta.title,
    // 面接官メモ・振り返り解説は渡さない（04 §3.3）
    statement: p.body.statement,
    constraints: p.body.constraints,
    timeLimitSec: session.problem.time_limit_sec,
    language: session.problem.language,
    files,
    capture: sp.norec === "1" ? { ...session.capture_options, camera: false, screen: false } : session.capture_options,
    interviewerMode: mode,
    followups: p.meta.followups,
    testsKind: tests.kind,
    webTests:
      tests.kind === "web"
        ? { preview: { tailwind: tests.preview.tailwind }, mockApi: tests.mockApi ?? null, layout: tests.layout, scenarios: tests.scenarios.map((s) => ({ name: s.name, steps: s.steps, tags: s.tags, weight: s.weight })) }
        : null,
    sampleStdin: tests.kind === "stdio" ? await sampleStdin(p.dir, tests.cases.find((c) => c.visibility === "sample")) : "",
    runnerOff: sp.runner === "off" && (tests.kind === "stdio" || tests.kind === "unit"),
  };
  return <InterviewScreen data={data} recordingEnabled={sp.norec !== "1"} />;
}
