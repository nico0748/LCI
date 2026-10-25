import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx.ts";

export type DlItem = { term: ReactNode; description: ReactNode; numeric?: boolean };

/**
 * 説明リスト。DADS `Dl`（dt は太字・dd は字下げ）を LCI の密度にしたもの:
 * 2 列 grid、dt は 13px の muted（太字にしない）、dd は 14px（数値は tabular）。
 * layout="stack" は dt の下に dd（狭いペイン・指標タイル用）。
 */
export function Dl({ items, layout = "grid", className }: { items: DlItem[]; layout?: "grid" | "stack"; className?: string }) {
  return (
    <dl className={cx(layout === "grid" ? "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5" : "flex flex-col gap-2", className)}>
      {items.map((item, i) => (
        <div key={i} className={layout === "grid" ? "contents" : "flex flex-col gap-0.5"}>
          <dt className="text-dns-13N-130 text-fg-muted">{item.term}</dt>
          <dd className={cx("m-0 text-dns-14N-130 text-fg-body min-w-0 break-words", item.numeric && "tabular-nums")}>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 面（カード）。DADS `Card` は画像付きの導線用なので使わず、枠線と面の明度差だけの軽量版にする。
 * 影は付けない（影はオーバーレイ専用、01 §4.3）。
 */
export function Card({ className, padding = "md", ...rest }: HTMLAttributes<HTMLDivElement> & { padding?: "none" | "sm" | "md" }) {
  return (
    <div
      className={cx("rounded-8 border border-border bg-surface", padding === "md" ? "p-4" : padding === "sm" ? "p-3" : "", className)}
      {...rest}
    />
  );
}

export type SectionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  /** 見出しのレベル（ページ内の構造に合わせる。既定 h2） */
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  actions?: ReactNode;
  /** 見出しの大きさ: section = std-20B-150（ページの節）、panel = dns-16B-130（カード・パネル）、pane = dns-14B-130（ペイン内） */
  size?: "section" | "panel" | "pane";
};

const headingSize = { section: "text-std-20B-150", panel: "text-dns-16B-130", pane: "text-dns-14B-130" } as const;

/** 見出し付きの区画。<section aria-labelledby> にして、ランドマークとして辿れるようにする */
export function Section({ title, headingLevel = 2, description, actions, size = "section", className, children, id, ...rest }: SectionProps) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const autoId = useId();
  const headingId = id ? `${id}-heading` : autoId;
  return (
    <section id={id} aria-labelledby={headingId} className={cx("flex flex-col gap-3", className)} {...rest}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <H id={headingId} className={cx(headingSize[size], "text-fg")}>
            {title}
          </H>
          {description && <p className="text-dns-14N-130 text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * ページの見出し帯（h1 + 説明 + 操作）。DADS に部品は無いが、見出しは std-24B-150。
 * パンくずは breadcrumbs に渡す（h1 の上に置く）。
 */
export function PageHeader({ title, description, actions, breadcrumbs, meta, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <header className={cx("flex flex-col gap-2 pb-4", className)}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-std-24B-150 text-fg">{title}</h1>
          {description && <p className="max-w-[72ch] text-std-16N-170 text-fg-muted">{description}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 text-dns-13N-130 text-fg-muted">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** データが無いときの表示。何が無いか・次に何をすればよいかを文で書く（イラストは置かない） */
export function EmptyState({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-start gap-2 rounded-8 border border-dashed border-border-strong bg-surface p-6", className)}>
      <p className="text-dns-16B-130 text-fg">{title}</p>
      {description && <p className="text-std-14N-170 text-fg-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * 読み込み中の文言（スケルトンもスピナーも使わない）。role="status" で 1 回だけ読み上げる。
 * DADS ProgressIndicator の代わり。面接中に限らず、動く表示を置かない方針（01 §4.5）。
 */
export function LoadingText({ children = "読み込み中…", className }: { children?: ReactNode; className?: string }) {
  return (
    <p role="status" className={cx("text-dns-14N-130 text-fg-muted", className)}>
      {children}
    </p>
  );
}
