import Link from "next/link";
import { CATEGORY_LABEL, LANGUAGE_LABEL } from "@lci/core";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { Disclosure, LinkButton, NotificationBanner, PageHeader, Section, StatusBadge } from "@/components/ui";
import { loadBrowseData } from "./problems/browse-data.ts";
import {
  SESSION_STATUS_LABEL,
  buildRecords,
  categoryProgress,
  formatDay,
  formatWhen,
  isUnfinished,
  latestEval,
  latestEvaluated,
  recommend,
  type ProblemRecord,
  type Recommendation,
  type SessionLite,
} from "./problems/browse-model.ts";
import { Chevron, Dot, NextPracticeList, OverallText, ProblemFacts, SessionStatusBadge, rowLinkClass, stretchedLinkClass } from "./problems/browse-ui.tsx";
import { DiscardSessionButton } from "./problems/DiscardSessionButton.tsx";

export const dynamic = "force-dynamic";

/**
 * ホーム =「次の 1 本を決める画面」（02 §2.1 / §3.1）。
 * 上から: 途中のセッション（あるときだけ）→ 次に意識すること（最新評価の next_practice）→ 次の 1 問（理由付きの候補）
 * → カテゴリから探す（二次導線）→ 最近のセッション。初回はこれを「はじめの 1 問」と保存場所の説明に置き換える。
 */
export default async function Home() {
  const { problems, sessions } = await loadBrowseData();
  const records = buildRecords(sessions);
  const unfinished = sessions.filter(isUnfinished);
  const done = sessions.filter((s) => !isUnfinished(s));
  const latest = latestEvaluated(done);
  const recs = recommend(problems, records, sessions);
  const cats = categoryProgress(problems, records);
  const firstRun = done.length === 0;

  return (
    <PageContainer as="main" className="flex flex-col gap-8">
      <PageHeader
        className="pb-0"
        title={firstRun ? "ようこそ" : "次の練習"}
        description="説明しながら書く。終わったら、話したことと書いたことを突き合わせて振り返る。"
      />

      {unfinished.length > 0 && <UnfinishedBanner sessions={unfinished} />}

      {!firstRun && (
        <Section
          title="次に意識すること"
          description={latest ? `${formatDay(latest.evaluation.created_at)} の評価（${latest.session.problem.title}）から` : undefined}
          actions={
            latest && (
              <LinkButton href={`/sessions/${latest.session.session_id}`} variant="tertiary" size="sm">
                そのレビューを開く
              </LinkButton>
            )
          }
        >
          {latest && latest.evaluation.next_practice.length > 0 ? (
            <NextPracticeList items={latest.evaluation.next_practice} />
          ) : (
            <p className="rounded-8 border border-dashed border-border-strong bg-surface p-4 text-std-14N-170 text-fg-muted">
              まだ評価がありません。レビュー画面で評価を依頼すると、次に意識することがここに出ます。
            </p>
          )}
        </Section>
      )}

      <Section
        title={firstRun ? "はじめの 1 問" : "次の 1 問"}
        description={firstRun ? "フロントの小さな機能を 20 分で。まずは 1 回、流れをつかむのが目的です。" : "直近の練習から決まったルールで選んでいます。理由を確かめて選んでください。"}
        actions={
          <LinkButton href="/problems" variant="tertiary" size="sm">
            すべての問題
          </LinkButton>
        }
      >
        {recs.length === 0 ? (
          <p className="text-std-14N-170 text-fg-muted">候補になる未着手の問題がありません。問題一覧から再挑戦する問題を選んでください。</p>
        ) : (
          <>
            <ul className="grid gap-3 desktop:grid-cols-3">
              {recs.map((r, i) => (
                // モバイルでは先頭の 1 枚だけを出し、残りは下の「ほかの候補」に入れる
                <li key={r.problem.id} className={i === 0 ? "flex" : "hidden desktop:flex"}>
                  <RecommendCard r={r} record={records.get(r.problem.id)} />
                </li>
              ))}
            </ul>
            {recs.length > 1 && (
              <Disclosure className="desktop:hidden" summary="ほかの候補" meta={`${recs.length - 1} 件`}>
                <ul className="flex flex-col gap-3">
                  {recs.slice(1).map((r) => (
                    <li key={r.problem.id} className="flex">
                      <RecommendCard r={r} record={records.get(r.problem.id)} />
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </>
        )}
      </Section>

      <Section title="カテゴリから探す" size="section">
        <ul className="grid overflow-hidden rounded-8 border border-border bg-surface desktop:grid-cols-3">
          {cats
            .filter((c) => c.total > 0)
            .map((c) => (
              <li key={c.category} className="relative -mb-px flex min-h-12 items-center gap-3 border-b border-border-subtle px-4 py-2 can-hover:bg-hover">
                <span className="w-10 shrink-0 text-mono-13N-150 text-fg-muted">{c.category}</span>
                <Link href={`/problems?category=${c.category}`} className={`${rowLinkClass} min-w-0 flex-1 text-dns-14N-130`}>
                  {CATEGORY_LABEL[c.category]}
                </Link>
                <span className="shrink-0 text-dns-13N-130 text-fg-muted">
                  挑戦 <span className="tabular-nums text-fg-body">{c.tried}</span> / <span className="tabular-nums">{c.total}</span>
                </span>
                <Chevron />
              </li>
            ))}
        </ul>
        {cats.some((c) => c.total === 0) && (
          <p className="text-dns-13N-130 text-fg-muted">
            準備中（0 問）:{" "}
            {cats
              .filter((c) => c.total === 0)
              .map((c) => CATEGORY_LABEL[c.category])
              .join("・")}
          </p>
        )}
      </Section>

      {done.length > 0 && (
        <Section
          title="最近のセッション"
          actions={
            <LinkButton href="/sessions" variant="tertiary" size="sm">
              すべての履歴
            </LinkButton>
          }
        >
          <ul className="rounded-8 border border-border bg-surface">
            {done.slice(0, 3).map((s) => (
              <RecentRow key={s.session_id} s={s} />
            ))}
          </ul>
        </Section>
      )}

      <p className="max-w-[72ch] text-std-14N-170 text-fg-muted">
        録画・編集ログ・文字起こしは、この Mac の <code className="text-mono-13N-150 text-fg-body">data/sessions/</code> に保存されます。外部に送られるのは、レビュー画面で評価を依頼したときの評価用データだけです。
      </p>
    </PageContainer>
  );
}

/** 途中のセッション（02 §2.1-1）。最新の 1 件に操作を付け、残りは件数で履歴へ誘導する */
function UnfinishedBanner({ sessions }: { sessions: SessionLite[] }) {
  const s = sessions[0]!;
  return (
    <NotificationBanner
      tone="warning"
      live="off"
      headingLevel={2}
      title={sessions.length === 1 ? "途中のセッションがあります" : `途中のセッションが ${sessions.length} 件あります`}
      actions={
        <>
          <LinkButton href={`/sessions/${s.session_id}`} size="sm">
            記録されたところまでレビュー
          </LinkButton>
          <DiscardSessionButton sessionId={s.session_id} label={`${formatWhen(s.started_at_wall)} の ${s.problem.title}`} />
          {sessions.length > 1 && (
            <LinkButton href="/sessions#unfinished" variant="tertiary" size="sm">
              {sessions.length} 件を履歴で確認
            </LinkButton>
          )}
        </>
      }
    >
      <span className="text-mono-13N-150">{formatWhen(s.started_at_wall)}</span> · {s.problem.title} · {SESSION_STATUS_LABEL[s.status]}
    </NotificationBanner>
  );
}

function RecommendCard({ r, record }: { r: Recommendation; record: ProblemRecord | undefined }) {
  const p = r.problem;
  return (
    <article className="relative flex w-full flex-col gap-2 rounded-8 border border-border bg-surface p-4 can-hover:border-border-strong">
      <div className="flex items-center gap-2">
        <StatusBadge tone="info" glyph={false}>
          {r.reason}
        </StatusBadge>
        <span className="ml-auto text-mono-12N-120 text-fg-muted">{p.id}</span>
      </div>
      <h3 className="text-std-16B-170 text-fg">
        <Link href={`/problems/${p.id}`} className={stretchedLinkClass}>
          {p.title}
        </Link>
      </h3>
      <ProblemFacts p={p} languages={p.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")} />
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-dns-13N-130 text-fg-muted">
          {record ? (
            <>
              {record.attempts} 回挑戦 <Dot /> 前回 {formatDay(record.lastAt)}
              {record.lastOverall != null && (
                <>
                  {" "}
                  <Dot /> <OverallText value={record.lastOverall} />
                </>
              )}
            </>
          ) : (
            "未着手"
          )}
        </span>
        <span aria-hidden="true" className="inline-flex items-center gap-0.5 text-dns-14N-130 text-link">
          詳細
          <Chevron className="text-link" />
        </span>
      </div>
    </article>
  );
}

function RecentRow({ s }: { s: SessionLite }) {
  const e = latestEval(s);
  return (
    <li className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3 last:border-b-0 can-hover:bg-hover">
      <Link href={`/sessions/${s.session_id}`} className={`${rowLinkClass} min-w-0 basis-full text-dns-14B-130 desktop:basis-auto desktop:flex-1`}>
        {s.problem.title}
      </Link>
      <span className="text-mono-12N-120 text-fg-muted">{formatWhen(s.started_at_wall)}</span>
      <SessionStatusBadge status={s.status} />
      <OverallText value={e?.overall ?? null} />
      <Chevron className="ml-auto desktop:ml-0" />
    </li>
  );
}
