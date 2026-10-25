import Link from "next/link";
import { AXES, CATEGORY_LABEL, LANGUAGE_LABEL, fmtT, type ProblemSummary } from "@lci/core";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { EmptyState, LinkButton, PageHeader, Section, TBody, THead, Table, TableScroll, Td, Th, Tr, cx } from "@/components/ui";
import { Sparkline } from "@/components/review/Sparkline";
import { loadBrowseData } from "../problems/browse-data.ts";
import {
  CATEGORY_ORDER,
  DIFFICULTIES,
  formatDay,
  formatDelta,
  formatWhen,
  isUnfinished,
  latestEval,
  latestEvaluated,
  practiceSummary,
  wallTime,
  type EvalLite,
  type SessionLite,
} from "../problems/browse-model.ts";
import { Dot, NextPracticeList, SessionStatusBadge } from "../problems/browse-ui.tsx";
import { DiscardSessionButton } from "../problems/DiscardSessionButton.tsx";

export const dynamic = "force-dynamic";

/** 傾向グラフ・カテゴリ表を出すのに要る件数（04 §6.5: 数値が少ないときのグラフは誤解を生む） */
const MIN_FOR_TREND = 5;

type View = "time" | "problem";

/**
 * S6 履歴（02 §2.4 / §3.4）=「成長と、次の一手が見える」。
 * 次にやること → 要約の数 3 つ → 推移 → 未完了（操作付き）→ セッション（時系列 / 問題ごと）→ カテゴリ × 難易度。
 * 768px 未満では表をやめてカードにする（横スクロールの表は比較に使えない）。
 */
export default async function SessionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const view: View = sp.view === "problem" ? "problem" : "time";
  const { problems, sessions } = await loadBrowseData();
  const byId = new Map(problems.map((p) => [p.id, p]));
  const unfinished = sessions.filter(isUnfinished);
  const done = sessions.filter((s) => !isUnfinished(s));
  const latest = latestEvaluated(done);
  const summary = practiceSummary(sessions);
  const deltas = overallDeltas(done);

  if (sessions.length === 0) {
    return (
      <PageContainer as="main" className="flex flex-col gap-6">
        <PageHeader className="pb-0" title="履歴" />
        <EmptyState
          title="まだセッションがありません"
          description="問題を 1 つ選んで練習すると、ここに記録と、評価から出た次の練習テーマがたまります。"
          action={
            <LinkButton href="/problems" variant="primary" size="sm">
              問題を選ぶ
            </LinkButton>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer as="main" className="flex flex-col gap-8">
      <PageHeader className="pb-0" title="履歴" description="何が伸びて、何が残っているか。次の練習で意識することを確かめる。" />

      {latest && latest.evaluation.next_practice.length > 0 && (
        <Section title="次にやること" description={`${formatDay(latest.evaluation.created_at)} の評価（${latest.session.problem.title}）から`}>
          <NextPracticeList
            items={latest.evaluation.next_practice}
            footer={
              <span className="flex flex-wrap gap-2">
                <LinkButton href={`/sessions/${latest.session.session_id}`} variant="tertiary" size="xs">
                  根拠のレビューを開く
                </LinkButton>
                <LinkButton href={`/problems/${latest.session.problem.id}`} variant="tertiary" size="xs">
                  同じ問題に再挑戦
                </LinkButton>
              </span>
            }
          />
        </Section>
      )}

      <section aria-label="練習の要約">
        <dl className="grid grid-cols-3 divide-x divide-border-subtle rounded-8 border border-border bg-surface">
          <Stat term="練習" value={summary.count} unit="回" />
          <Stat term="合計時間" value={summary.minutes} unit="分" />
          <Stat term="評価済み" value={summary.evaluated} unit="回" />
        </dl>
      </section>

      <Trend done={done} />

      {unfinished.length > 0 && (
        <Section id="unfinished" title={`未完了 ${unfinished.length} 件`} description="記録が途中で止まった、または処理が終わっていないセッションです。記録されたところまでレビューするか、破棄できます。">
          <ul className="rounded-8 border border-border bg-surface">
            {unfinished.map((s) => (
              <li key={s.session_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                  <span className="text-dns-14B-130 text-fg">{s.problem.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-dns-13N-130 text-fg-muted">
                    <span className="text-mono-12N-120">{formatWhen(s.started_at_wall)}</span>
                    <SessionStatusBadge status={s.status} />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <LinkButton href={`/sessions/${s.session_id}`} size="sm">
                    レビュー
                  </LinkButton>
                  <DiscardSessionButton sessionId={s.session_id} label={`${formatWhen(s.started_at_wall)} の ${s.problem.title}`} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {done.length > 0 && (
        <Section id="sessions" title="セッション" actions={<ViewSwitch view={view} />}>
          {view === "time" ? <TimeView done={done} deltas={deltas} /> : <ProblemView done={done} deltas={deltas} byId={byId} />}
        </Section>
      )}

      {done.length >= MIN_FOR_TREND && <CategoryTable done={done} byId={byId} />}
    </PageContainer>
  );
}

// ---- 要約 --------------------------------------------------------------------

function Stat({ term, value, unit }: { term: string; value: number; unit: string }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <dt className="text-dns-13N-130 text-fg-muted">{term}</dt>
      <dd className="m-0 flex items-baseline gap-1">
        <span className="text-oln-24B-100 text-fg">{value}</span>
        <span className="text-dns-13N-130 text-fg-muted">{unit}</span>
      </dd>
    </div>
  );
}

// ---- 推移 --------------------------------------------------------------------

function Trend({ done }: { done: SessionLite[] }) {
  const evals = done
    .map((s) => latestEval(s))
    .filter((e): e is EvalLite => e != null)
    .sort((a, b) => wallTime(a.created_at) - wallTime(b.created_at));
  const recent = evals.slice(-10);
  if (evals.length === 0) {
    return (
      <Section title="推移">
        <EmptyState title="評価済みのセッションがまだありません" description="レビュー画面で評価を依頼すると、8 つの観点の点数がここにたまります。5 件たまると傾向をグラフで示します。" />
      </Section>
    );
  }
  const last = recent[recent.length - 1]!;
  if (evals.length < MIN_FOR_TREND) {
    // 件数が少ないうちは文章と最新の点数で。グラフにすると 1 点の揺れが傾向に見えてしまう
    const sorted = [...AXES].sort((a, b) => last.scores[a.id] - last.scores[b.id]);
    const low = sorted.slice(0, 2);
    const high = sorted.slice(-2).reverse();
    return (
      <Section title="推移" description={`評価は ${evals.length} 件です。${MIN_FOR_TREND} 件たまるまでは傾向グラフを出さず、最新の評価を示します。`}>
        <div className="grid gap-4 rounded-8 border border-border bg-surface p-4 desktop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] desktop:gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-std-16N-170 text-fg-body">
              直近の評価では <strong className="font-bold text-fg">{high.map((a) => a.label).join("・")}</strong> が高く、
              <strong className="font-bold text-fg">{low.map((a) => a.label).join("・")}</strong> が低めでした。
            </p>
            {last.summary && <p className="text-std-14N-170 text-fg-muted">{last.summary}</p>}
            <p className="text-dns-13N-130 text-fg-muted">
              総合 <span className="text-mono-13N-150 text-fg-body">{last.overall.toFixed(1)}</span>（要約の値。観点ごとの点を優先して見てください）
            </p>
          </div>
          <ul aria-label="最新の評価の観点別の点数（5 段階）" className="grid gap-x-6 gap-y-2 desktop:grid-cols-2">
            {AXES.map((a) => (
              <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto_1.5rem] items-center gap-2">
                <span className="truncate text-dns-14N-130 text-fg-body" title={a.description}>
                  {a.label}
                </span>
                <ScoreDots score={last.scores[a.id]} />
                <span className="text-right text-mono-13N-150 text-fg">
                  {last.scores[a.id]}
                  <span className="sr-only"> / 5</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }
  const ratios = done
    .filter((s) => s.silentEditRatio != null)
    .sort((a, b) => wallTime(a.started_at_wall) - wallTime(b.started_at_wall))
    .slice(-10)
    .map((s) => Math.round(s.silentEditRatio! * 100));
  return (
    <Section title="推移" description={`直近 ${recent.length} 件の評価。線は 1〜5 の点数、横線は基準の 3。`}>
      <ul className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
        {AXES.map((a) => {
          const v = recent.map((e) => e.scores[a.id]);
          // 観点の点数は整数なので、前回比も整数で書く（+1 / −1）
          const diff = (v[v.length - 1] ?? 0) - (v[0] ?? 0);
          const delta = diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : null;
          return (
            <li key={a.id} className="flex min-w-0 flex-col gap-2 rounded-8 border border-border bg-surface p-3">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-dns-13N-130 text-fg-muted" title={a.description}>
                  {a.label}
                </span>
                <span className="text-mono-14N-150 text-fg">
                  {v[v.length - 1]}
                  {delta && <span className="ml-1 text-mono-12N-120 text-fg-muted">{delta}</span>}
                </span>
              </span>
              <TrendLine values={v} label={a.label} />
            </li>
          );
        })}
        {ratios.length >= MIN_FOR_TREND && (
          <li className="flex min-w-0 flex-col gap-2 rounded-8 border border-border bg-surface p-3">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-dns-13N-130 text-fg-muted">無言で書いた割合</span>
              <span className="text-mono-14N-150 text-fg">{ratios[ratios.length - 1]}%</span>
            </span>
            <TrendLine values={ratios} label="無言で書いた割合（%、低いほど良い）" min={0} max={100} />
          </li>
        )}
      </ul>
      <p className="text-dns-13N-130 text-fg-muted">
        最新の総合 <span className="text-mono-13N-150 text-fg-body">{last.overall.toFixed(1)}</span>（要約の値）
      </p>
    </Section>
  );
}

/** Sparkline は幅が固定なので、タイルの幅に合わせて 2 つの幅を用意して切り替える（読み上げは見えている方だけ） */
function TrendLine({ values, label, min, max }: { values: number[]; label: string; min?: number; max?: number }) {
  return (
    <>
      <span className="desktop:hidden">
        <Sparkline values={values} label={label} width={136} height={32} min={min} max={max} />
      </span>
      <span className="hidden desktop:block">
        <Sparkline values={values} label={label} width={232} height={36} min={min} max={max} />
      </span>
    </>
  );
}

/** 1〜5 の点を 5 つの丸で（塗り = accent、空き = 枠だけ）。数値は隣に必ず出す */
function ScoreDots({ score }: { score: number }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cx("size-2.5 rounded-full border", n <= score ? "border-accent bg-accent" : "border-border-strong bg-transparent")} />
      ))}
    </span>
  );
}

// ---- セッションの一覧 --------------------------------------------------------

/** 各セッションの総合の前回比（同じ問題の 1 つ前の評価済みセッションと比べる） */
function overallDeltas(done: SessionLite[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const prev = new Map<string, number>();
  for (const s of [...done].sort((a, b) => wallTime(a.started_at_wall) - wallTime(b.started_at_wall))) {
    const e = latestEval(s);
    if (!e) continue;
    out.set(s.session_id, formatDelta(e.overall, prev.get(s.problem.id) ?? null));
    prev.set(s.problem.id, e.overall);
  }
  return out;
}

function ViewSwitch({ view }: { view: View }) {
  const item = (v: View, label: string) => (
    <Link
      href={v === "time" ? "/sessions#sessions" : "/sessions?view=problem#sessions"}
      aria-current={view === v ? "true" : undefined}
      scroll={false}
      className={cx(
        "inline-flex min-h-8 items-center px-3 text-dns-14N-130 no-underline first:rounded-l-6 last:rounded-r-6",
        view === v ? "bg-selected text-fg shadow-[inset_0_-2px_0_var(--accent)]" : "text-fg-muted can-hover:bg-hover can-hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="セッションの並べ方" className="inline-flex divide-x divide-border-input rounded-6 border border-border-input bg-surface">
      {item("time", "時系列")}
      {item("problem", "問題ごと")}
    </nav>
  );
}

function OverallCell({ s, delta }: { s: SessionLite; delta: string | null | undefined }) {
  const e = latestEval(s);
  if (!e) return <span className="text-dns-13N-130 text-fg-muted">未評価</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
      <span className="text-mono-14N-150 text-fg">{e.overall.toFixed(1)}</span>
      {delta && <span className="text-mono-12N-120 text-fg-muted">{delta}</span>}
      {s.evaluations.length > 1 && <span className="text-dns-13N-130 text-fg-muted">評価 {s.evaluations.length} 回</span>}
    </span>
  );
}

function TimeView({ done, deltas }: { done: SessionLite[]; deltas: Map<string, string | null> }) {
  return (
    <>
      <TableScroll className="hidden desktop:block">
        <Table caption="セッション（新しい順）" captionHidden>
          <THead>
            <tr>
              <Th>問題</Th>
              <Th>日時</Th>
              <Th numeric>時間</Th>
              <Th>状態</Th>
              <Th numeric>総合（前回比）</Th>
              <Th>
                <span className="sr-only">操作</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {done.map((s) => (
              <Tr key={s.session_id}>
                <Td className="py-2.5">
                  <Link href={`/sessions/${s.session_id}`} className="text-dns-14B-130 text-link underline underline-offset-[3px] can-hover:decoration-2 focus-text">
                    {s.problem.title}
                  </Link>
                  <div className="mt-1 text-mono-12N-120 text-fg-muted">
                    {s.problem.id} · {LANGUAGE_LABEL[s.problem.language]}
                  </div>
                </Td>
                <Td mono className="text-fg-muted">
                  {formatWhen(s.started_at_wall)}
                </Td>
                <Td numeric className="text-mono-13N-150">
                  {s.durationMs != null ? fmtT(s.durationMs) : "—"}
                </Td>
                <Td>
                  <SessionStatusBadge status={s.status} />
                </Td>
                <Td numeric>
                  <OverallCell s={s} delta={deltas.get(s.session_id)} />
                </Td>
                <Td className="text-right">
                  <LinkButton href={`/problems/${s.problem.id}`} size="xs" aria-label={`${s.problem.title} に再挑戦`}>
                    再挑戦
                  </LinkButton>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableScroll>
      <ul aria-label="セッション（新しい順）" className="flex flex-col gap-3 desktop:hidden">
        {done.map((s) => (
          <li key={s.session_id} className="flex flex-col gap-2 rounded-8 border border-border bg-surface p-4">
            <span className="flex flex-wrap items-center gap-2 text-dns-13N-130 text-fg-muted">
              <span className="text-mono-12N-120">{formatWhen(s.started_at_wall)}</span>
              <Dot />
              <span className="text-mono-12N-120">{s.durationMs != null ? fmtT(s.durationMs) : "—"}</span>
              <SessionStatusBadge status={s.status} />
            </span>
            <span className="text-dns-16B-130 text-fg">{s.problem.title}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="text-mono-12N-120 text-fg-muted">{s.problem.id}</span>
              <OverallCell s={s} delta={deltas.get(s.session_id)} />
            </span>
            <span className="mt-1 grid grid-cols-2 gap-2">
              <LinkButton href={`/sessions/${s.session_id}`} size="md" aria-label={`${s.problem.title}（${formatWhen(s.started_at_wall)}）のレビュー`}>
                レビュー
              </LinkButton>
              <LinkButton href={`/problems/${s.problem.id}`} size="md" variant="tertiary" aria-label={`${s.problem.title} に再挑戦`}>
                再挑戦
              </LinkButton>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProblemView({ done, deltas, byId }: { done: SessionLite[]; deltas: Map<string, string | null>; byId: Map<string, ProblemSummary> }) {
  // 問題ごとにまとめ、最後に練習した順に並べる（done は新しい順）
  const groups = new Map<string, SessionLite[]>();
  for (const s of done) groups.set(s.problem.id, [...(groups.get(s.problem.id) ?? []), s]);
  return (
    <ul className="flex flex-col gap-3">
      {[...groups.entries()].map(([pid, list]) => {
        const p = byId.get(pid);
        const scored = list.map((s) => latestEval(s)?.overall).filter((v): v is number => v != null);
        const best = scored.length ? Math.max(...scored) : null;
        return (
          <li key={pid} className="rounded-8 border border-border bg-surface">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3">
              <span className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
                <span className="text-dns-16B-130 text-fg">{list[0]!.problem.title}</span>
                <span className="flex flex-wrap items-center gap-x-1.5 text-dns-13N-130 text-fg-muted">
                  <span className="text-mono-12N-120">{pid}</span>
                  {p && (
                    <>
                      <Dot /> {CATEGORY_LABEL[p.category]} <Dot /> <span className="text-mono-12N-120">{p.difficulty}</span>
                    </>
                  )}
                  <Dot /> {list.length} 回
                  {best != null && (
                    <>
                      <Dot /> ベスト <span className="text-mono-13N-150 text-fg-body">{best.toFixed(1)}</span>
                    </>
                  )}
                </span>
              </span>
              <LinkButton href={`/problems/${pid}`} size="sm" aria-label={`${list[0]!.problem.title} に再挑戦`}>
                再挑戦
              </LinkButton>
            </div>
            <ol aria-label={`${list[0]!.problem.title} の各回（新しい順）`}>
              {list.map((s) => (
                <li key={s.session_id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-2.5 last:border-b-0 can-hover:bg-hover">
                  <Link
                    href={`/sessions/${s.session_id}`}
                    className="text-mono-13N-150 text-link underline underline-offset-[3px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:shadow-none focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-focus-outer"
                  >
                    {formatWhen(s.started_at_wall)}
                    <span className="sr-only"> のレビュー</span>
                  </Link>
                  <span className="text-mono-12N-120 text-fg-muted">{s.durationMs != null ? fmtT(s.durationMs) : "—"}</span>
                  <SessionStatusBadge status={s.status} />
                  <span className="ml-auto">
                    <OverallCell s={s} delta={deltas.get(s.session_id)} />
                  </span>
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}

/** カテゴリ × 難易度の挑戦回数（FR-U-18）。色の濃淡は使わず数を書く */
function CategoryTable({ done, byId }: { done: SessionLite[]; byId: Map<string, ProblemSummary> }) {
  const count = new Map<string, number>();
  for (const s of done) {
    const p = byId.get(s.problem.id);
    if (p) count.set(`${p.category}:${p.difficulty}`, (count.get(`${p.category}:${p.difficulty}`) ?? 0) + 1);
  }
  const cats = CATEGORY_ORDER.filter((c) => [...byId.values()].some((p) => p.category === c));
  return (
    <Section title="カテゴリ × 難易度" description="挑戦した回数。偏りを見て、次に広げる先を決める。">
      <TableScroll>
        <Table caption="カテゴリと難易度ごとの挑戦回数" captionHidden>
          <THead>
            <tr>
              <Th>カテゴリ</Th>
              {DIFFICULTIES.map((d) => (
                <Th key={d} numeric>
                  {d}
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {cats.map((c) => (
              <Tr key={c}>
                <Th scope="row" className="h-9 border-b-0 font-normal text-fg-body">
                  <span className="text-mono-12N-120 text-fg-muted">{c}</span> <span className="sr-only desktop:not-sr-only">{CATEGORY_LABEL[c]}</span>
                </Th>
                {DIFFICULTIES.map((d) => {
                  const n = count.get(`${c}:${d}`) ?? 0;
                  return (
                    <Td key={d} numeric className={n ? "text-fg" : "text-fg-muted"}>
                      {n || "—"}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableScroll>
    </Section>
  );
}
