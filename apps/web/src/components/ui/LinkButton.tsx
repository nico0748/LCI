import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./classes.ts";
import { cx } from "./cx.ts";

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/**
 * ボタンの見た目のリンク（画面遷移する操作）。DADS `Button` の `asChild` で <a> にする使い方に相当。
 * 遷移しない操作には Button を使う。無効状態は持たない（行けない先へのリンクは出さない）。
 */
export function LinkButton({ variant = "secondary", size = "sm", icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link data-ui="button" className={cx(buttonClasses({ variant, size }), "no-underline", className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
