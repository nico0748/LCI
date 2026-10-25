"use client";

import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx.ts";

/**
 * 密な表。DADS の Table（story のみ）から: <th scope>、ソートは <th aria-sort> の中の <button>。
 * LCI 版は行 36（compact）、px-3 py-2、14px、縞模様なし、hover は --bg-hover、
 * 選択行（j/k）は --bg-selected と左 2px の accent。ヘッダは sticky にできる。
 * 行全体をリンクにするときは、最初のセルの <a> に `tableRowLinkClass` を付ける（::after で行全体に広げる）。
 * 選択行は色だけでなく、行内のリンクに aria-current="true" を付けて読み上げにも伝える。
 */
export function Table({ className, children, caption, captionHidden, ...rest }: HTMLAttributes<HTMLTableElement> & { caption?: ReactNode; captionHidden?: boolean }) {
  return (
    <table className={cx("w-full border-collapse text-dns-14N-130 text-fg-body", className)} {...rest}>
      {caption && <caption className={cx("mb-2 text-left text-dns-14B-130 text-fg", captionHidden && "sr-only")}>{caption}</caption>}
      {children}
    </table>
  );
}

/** スクロール領域。sticky ヘッダはこの中で効く */
export function TableScroll({ className, maxHeight, ...rest }: HTMLAttributes<HTMLDivElement> & { maxHeight?: string }) {
  return <div className={cx("overflow-auto rounded-8 border border-border bg-surface", className)} style={maxHeight ? { maxHeight } : undefined} {...rest} />;
}

export function THead({ sticky, className, ...rest }: HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return <thead className={cx(sticky && "sticky top-0 z-[1]", "bg-canvas", className)} {...rest} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ selected, interactive, className, ...rest }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; interactive?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cx(
        "border-b border-border-subtle last:border-b-0",
        interactive && "relative can-hover:bg-hover",
        "data-[selected]:bg-selected data-[selected]:shadow-[inset_2px_0_0_var(--accent)]",
        className,
      )}
      {...rest}
    />
  );
}

export type SortDirection = "ascending" | "descending" | "none";

export function Th({
  numeric,
  sort,
  onSort,
  className,
  children,
  scope = "col",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; sort?: SortDirection; onSort?: () => void }) {
  const label = (
    <>
      {children}
      {sort && sort !== "none" && <span aria-hidden="true">{sort === "ascending" ? "▲" : "▼"}</span>}
    </>
  );
  return (
    <th
      scope={scope}
      aria-sort={sort}
      className={cx(
        "h-9 border-b border-border-strong px-3 py-2 text-dns-13N-130 font-bold text-fg-muted whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {onSort ? (
        <button type="button" onClick={onSort} className="inline-flex items-center gap-1 rounded-4 can-hover:underline can-hover:text-fg">
          {label}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function Td({ numeric, mono, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; mono?: boolean }) {
  return (
    <td
      className={cx(
        "h-9 px-3 py-2 align-middle",
        numeric && "text-right tabular-nums whitespace-nowrap",
        mono && "text-mono-13N-150 whitespace-nowrap",
        className,
      )}
      {...rest}
    />
  );
}
