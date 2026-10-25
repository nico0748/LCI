"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cx } from "./cx.ts";

export type IconButtonSize = "sm" | "xs" | "2xs";

const sizeClass: Record<IconButtonSize, string> = {
  sm: "size-8 rounded-6",
  xs: "size-7 rounded-4",
  "2xs": "size-6 rounded-4",
};

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "aria-label" | "children"> & {
  /** 読み上げ名（必須）。見た目に文字が無いので、title にも同じ文言を入れる */
  label: string;
  /** 16px の SVG（aria-hidden にすること） */
  children: ReactNode;
  size?: IconButtonSize;
  /** ghost = 枠なし（既定、ツールバー・行内）、secondary = 枠あり */
  variant?: "ghost" | "secondary";
  disabled?: boolean;
  /** トグルとして使うとき */
  pressed?: boolean;
};

/**
 * アイコンだけのボタン。DADS `Button` の text / outline を正方形にしたもの（DADS に専用部品は無い）。
 * 最小 24×24（WCAG 2.5.8）。隣と 8px 以上離して置く。
 */
export function IconButton({
  label,
  children,
  size = "sm",
  variant = "ghost",
  disabled,
  pressed,
  className,
  onClick,
  type = "button",
  title,
  ...rest
}: IconButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      type={type}
      data-ui="button"
      aria-label={label}
      title={title ?? label}
      aria-disabled={disabled || undefined}
      aria-pressed={pressed}
      onClick={handleClick}
      className={cx(
        "inline-flex shrink-0 items-center justify-center border text-fg-muted",
        "can-hover:bg-hover can-hover:text-fg can-active:bg-selected",
        "aria-pressed:bg-selected aria-pressed:text-fg aria-pressed:border-accent",
        "aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled",
        variant === "ghost" ? "border-transparent" : "border-border-input bg-surface",
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
