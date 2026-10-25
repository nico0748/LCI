import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cx } from "./cx.ts";

export type BreadcrumbItem = {
  label: ReactNode;
  /** 無ければ現在地（最後の項目） */
  href?: string;
  /** 省略表示したときの全文（セッション ID など） */
  title?: string;
  mono?: boolean;
};

/**
 * パンくずリスト。DADS `Breadcrumbs`: <nav aria-label> の中の <ol>、区切りの SVG は aria-hidden、
 * 現在地は aria-current="page" でリンクにしない。LCI 版は 13px、押下時の orange は使わない。
 */
export function Breadcrumbs({ items, label = "パンくずリスト", className }: { items: BreadcrumbItem[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 text-dns-13N-130 text-fg-muted">
        {items.map((item, i) => {
          const current = item.href === undefined;
          const content = (
            <span className={cx(item.mono && "text-mono-12N-120", "inline-block max-w-[28ch] truncate align-bottom")} title={item.title}>
              {item.label}
            </span>
          );
          return (
            <Fragment key={i}>
              <li className="flex min-w-0 items-center">
                {current ? (
                  <span aria-current="page" className="text-fg-body">
                    {content}
                  </span>
                ) : (
                  <Link href={item.href!} className="text-link underline underline-offset-[3px] can-hover:decoration-2 focus-text">
                    {content}
                  </Link>
                )}
                {i < items.length - 1 && (
                  <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" className="mx-1.5 shrink-0">
                    <path d="M4.5 1.3 3.8 2l4 4-4 4 .7.7L9.2 6Z" fill="currentColor" />
                  </svg>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
