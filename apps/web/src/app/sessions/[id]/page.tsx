import { notFound } from "next/navigation";
import { LANGUAGE_LABEL } from "@lci/core/browser";
import { problem, store } from "@/lib/server";
import { loadTimeline } from "@/lib/review/sessions-api";
import { Breadcrumbs, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { ReviewScreen } from "@/components/review/ReviewScreen";
import type { ReviewProblemInfo } from "@/components/review/types";
import { DeleteSessionButton } from "@/components/review/DeleteSessionButton";
import { fmtDuration } from "@/components/review/review-model";

export const dynamic = "force-dynamic";

/**
 * S5 レビュー。初期データはサーバで読み、以降はクライアントが単一時刻 t で同期する（FR-U-13）。
 * 問題の非公開部分（解説・参照解）はクライアントが `?reveal=1` で別途取得し、画面の最下部にだけ出す。
 * ナビゲーションはグローバルヘッダが持つので、ここでは パンくず・見出し・操作（もう一度解く / 削除）だけを置く。
 * 再生ワークスペースは広い画面で横幅を使うため、PageContainer は全幅にして中を 1600px で止める。
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
  const s = data.session;
  const started = new Date(s.started_at_wall).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
  return (
    <PageContainer as="main" width="full">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col">
        <PageHeader
          breadcrumbs={<Breadcrumbs items={[{ label: "履歴", href: "/sessions" }, { label: id, mono: true, title: id }]} />}
          title={s.problem.title}
          meta={
            <>
              <span className="text-mono-12N-120">{s.problem.id}</span>
              <span aria-hidden>·</span>
              <span>{LANGUAGE_LABEL[s.problem.language]}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{started}</span>
              {s.ended_t != null && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {fmtDuration(s.ended_t)}（制限 {Math.round(s.problem.time_limit_sec / 60)} 分）
                  </span>
                </>
              )}
              {s.status !== "ready" && (
                <StatusBadge tone={s.status === "failed" ? "danger" : "info"}>{s.status === "failed" ? "後処理に失敗" : "処理中"}</StatusBadge>
              )}
            </>
          }
          actions={
            <>
              <LinkButton href={`/problems/${s.problem.id}`}>もう一度解く</LinkButton>
              <DeleteSessionButton sessionId={id} />
            </>
          }
        />
        <ReviewScreen sessionId={id} initial={data} problem={info} initialEvaluations={evaluations} />
      </div>
    </PageContainer>
  );
}
