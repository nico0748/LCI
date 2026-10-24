import Link from "next/link";
import { notFound } from "next/navigation";
import { problem, store } from "@/lib/server";
import { loadTimeline } from "@/lib/review/sessions-api";
import { ReviewScreen } from "@/components/review/ReviewScreen";
import type { ReviewProblemInfo } from "@/components/review/types";
import { DeleteSessionButton } from "@/components/review/DeleteSessionButton";

export const dynamic = "force-dynamic";

/**
 * S5 レビュー。初期データはサーバで読み、以降はクライアントが単一時刻 t で同期する（FR-U-13）。
 * 問題の非公開部分（解説・参照解）はクライアントが `?reveal=1` で別途取得し、画面の最下部にだけ出す。
 */
export default async function SessionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadTimeline(id);
  if (!data) notFound();
  const p = await problem(data.session.problem.id);
  const info: ReviewProblemInfo | null = p
    ? { id: p.meta.id, title: p.meta.title, category: p.meta.category, talking_points: p.meta.talking_points, requirements: p.meta.requirements, languages: p.meta.languages }
    : null;
  const evaluations = await store().getEvaluations(id);
  return (
    <main className="w-full px-4 py-4 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <nav className="text-xs text-fg-muted flex gap-2">
            <Link href="/sessions" className="hover:text-fg">履歴</Link>
            <span>/</span>
            <span className="font-mono truncate">{id}</span>
          </nav>
          <h1 className="text-lg font-semibold tracking-tight truncate">
            {data.session.problem.title}
            <span className="ml-2 text-sm font-normal text-fg-muted font-mono">
              {data.session.problem.id} · {data.session.problem.language}
            </span>
          </h1>
        </div>
        <div className="text-xs text-fg-muted flex items-center gap-3">
          <span>{new Date(data.session.started_at_wall).toLocaleString("ja-JP")}</span>
          <Link href={`/problems/${data.session.problem.id}`} className="rounded border border-border px-2 py-1 hover:text-fg">
            もう一度解く
          </Link>
          <DeleteSessionButton sessionId={id} />
        </div>
      </header>
      <ReviewScreen sessionId={id} initial={data} problem={info} initialEvaluations={evaluations} />
    </main>
  );
}
