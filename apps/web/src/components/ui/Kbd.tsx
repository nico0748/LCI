import type { HTMLAttributes } from "react";
import { cx } from "./cx.ts";

export type KbdProps = HTMLAttributes<HTMLElement> & {
  /** muted = 面の上（既定）、on-fill = 塗りボタンの中 */
  tone?: "muted" | "on-fill";
};

/**
 * キーボードショートカットの表記。DADS に該当なし（LCI 拡張）。
 * 等幅 12px・枠付き。ボタンの中に置くときは Button の `kbd` を使う。
 */
export function Kbd({ tone = "muted", className, ...rest }: KbdProps) {
  return (
    <kbd
      className={cx(
        "inline-flex items-center min-h-[18px] px-1 rounded-4 border text-mono-12N-120 font-normal not-italic",
        tone === "muted" ? "border-border bg-surface text-fg-muted" : "border-current/40 text-current",
        className,
      )}
      {...rest}
    />
  );
}
