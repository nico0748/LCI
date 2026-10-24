import Link from "next/link";
import { notFound } from "next/navigation";
import { problem, store } from "@/lib/server";
import { InterviewScreenClient as InterviewScreen } from "@/components/session/client";
import type { InterviewData } from "@/components/session/types";

export const dynamic = "force-dynamic";

/** S3 面接セッション画面 */
export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await store().get(id);
  if (!session) notFound();
  if (session.status !== "preparing" && session.status !== "recording") {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 space-y-3">
        <h1 className="text-lg font-semibold">このセッションは終了しています</h1>
        <Link href={`/sessions/${encodeURIComponent(id)}`} className="text-accent text-sm">振り返りを開く →</Link>
      </main>
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
    sampleStdin: tests.kind === "stdio" ? (tests.cases.find((c) => c.visibility === "sample")?.stdin ?? "") : "",
  };
  return <InterviewScreen data={data} recordingEnabled={sp.norec !== "1"} />;
}
