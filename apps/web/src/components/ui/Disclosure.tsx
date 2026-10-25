import type { DetailsHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";

export type DisclosureProps = Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "title"> & {
  summary: ReactNode;
  children: ReactNode;
  /** summary の右に置く補足（件数など）。summary の読み上げに含まれる */
  meta?: ReactNode;
  summaryClassName?: string;
};

/**
 * 折りたたみ。DADS `Disclosure`（ネイティブ <details>/<summary>、マーカーは消す、hover で下線、focus は黄地）。
 * LCI 版はシェブロン 16px、向きは回転アニメーションなしで即時に切り替える。
 * 制御したいときは open と onToggle（e.currentTarget.open）を使う。
 */
export function Disclosure({ summary, children, meta, className, summaryClassName, ...rest }: DisclosureProps) {
  return (
    <details className={cx("group", className)} {...rest}>
      <summary
        className={cx(
          "inline-flex min-h-8 w-fit cursor-pointer items-center gap-1.5 rounded-4 text-dns-14B-130 text-fg focus-text",
          "can-hover:underline underline-offset-[3px]",
          summaryClassName,
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className="shrink-0 text-fg-muted group-open:rotate-90">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span>{summary}</span>
        {meta && <span className="text-dns-13N-130 font-normal text-fg-muted">{meta}</span>}
      </summary>
      <div className="pt-2 pl-[22px]">{children}</div>
    </details>
  );
}
