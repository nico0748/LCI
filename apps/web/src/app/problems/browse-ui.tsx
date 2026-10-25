/**
 * 閲覧画面（ホーム・問題一覧・問題詳細・履歴）で共有する小さな表示部品。サーバコンポーネントからも使える。
 * 汎用になりそうなもの（カード全体リンク、スコアの点列）は後で components/ui へ移す候補。
 */
import type { ReactNode } from "react";
import { CATEGORY_LABEL, type Axis, type ProblemSummary, type SessionStatus } from "@lci/core/browser";
import { StatusBadge, cx } from "@/components/ui";
import { AXIS_LABEL, SESSION_STATUS_LABEL, SESSION_STATUS_TONE } from "./browse-model.ts";

/**
 * カード全体を 1 つのリンクにするためのクラス（見出しの <a> に付ける）。::after をカードいっぱいに広げ、
 * フォーカスリングもカードの外周に描く（DADS の二重リングを ::after で再現）。カード側は relative にする。
 */
export const stretchedLinkClass =
  "text-fg no-underline underline-offset-[3px] can-hover:underline " +
  "after:absolute after:inset-0 after:rounded-8 after:content-[''] " +
  "focus-visible:outline-none focus-visible:shadow-none " +
  "focus-visible:after:outline-4 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-outer " +
  "focus-visible:after:shadow-[0_0_0_2px_var(--focus-inner)]";

/** 一覧の行（カード内の区切り行）全体を 1 つのリンクにするクラス。行の内側にリングを描く */
export const rowLinkClass =
  "text-fg no-underline underline-offset-[3px] can-hover:underline " +
  "after:absolute after:inset-0 after:content-[''] " +
  "focus-visible:outline-none focus-visible:shadow-none " +
  "focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-focus-outer";

/** 「FE フロント小機能実装 · L2 · 20 分」。short ではカテゴリ名を省く */
export function ProblemFacts({ p, short, languages, className }: { p: Pick<ProblemSummary, "category" | "difficulty" | "time_limit" | "languages">; short?: boolean; languages?: string; className?: string }) {
  return (
    <span className={cx("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-dns-13N-130 text-fg-muted", className)}>
      <span>
        <span className="text-mono-12N-120 text-fg-body">{p.category}</span>
        {!short && <span className="ml-1">{CATEGORY_LABEL[p.category]}</span>}
      </span>
      <Dot />
      <span className="text-mono-12N-120">{p.difficulty}</span>
      <Dot />
      <span className="tabular-nums">{p.time_limit} 分</span>
      {languages && (
        <>
          <Dot />
          <span>{languages}</span>
        </>
      )}
    </span>
  );
}

export function Dot() {
  return (
    <span aria-hidden="true" className="text-fg-muted">
      ·
    </span>
  );
}

/** セッションの状態（X2 のシステム状態色＋グリフ＋日本語） */
export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <StatusBadge tone={SESSION_STATUS_TONE[status]} glyph={status !== "ready" && status !== "preparing"}>
      {SESSION_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

/** 評価の next_practice（最大 3 件）。軸名＋行動文。ホームと履歴で同じ見た目にする */
export function NextPracticeList({ items, footer }: { items: { axis: Axis; action: string }[]; footer?: ReactNode }) {
  return (
    <div className="rounded-8 border border-border bg-surface">
      <ol className="divide-y divide-border-subtle">
        {items.map((n, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-2 gap-y-1 px-4 py-3 desktop:grid-cols-[1.5rem_10rem_1fr] desktop:items-baseline">
            <span aria-hidden="true" className="text-mono-13N-150 text-fg-muted">
              {i + 1}.
            </span>
            <span className="text-dns-14B-130 text-fg">{AXIS_LABEL[n.axis]}</span>
            <span className="col-start-2 text-std-16N-170 text-fg-body desktop:col-start-3">
              <span className="sr-only">: </span>
              {n.action}
            </span>
          </li>
        ))}
      </ol>
      {footer && <div className="border-t border-border-subtle px-4 py-2">{footer}</div>}
    </div>
  );
}

/** 右向きの小さなシェブロン（リンクの行末の飾り） */
export function Chevron({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className={cx("shrink-0 text-fg-muted", className)}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** 総合点の表示（評価が無ければ「未評価」）。総合は要約なので強調しすぎない（04 §7.4） */
export function OverallText({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cx("text-dns-13N-130 text-fg-muted", className)}>未評価</span>;
  return (
    <span className={cx("text-dns-13N-130 text-fg-muted", className)}>
      総合 <span className="text-mono-13N-150 text-fg-body">{value.toFixed(1)}</span>
    </span>
  );
}
