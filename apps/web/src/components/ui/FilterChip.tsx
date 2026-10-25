"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";

export type FilterChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed" | "onChange"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  /** 件数（静止した数字だけ） */
  count?: number;
};

/**
 * 絞り込みのトグル（aria-pressed を持つボタン）。状態チップ（StatusBadge）とは別部品にする:
 * こちらは押せる（高さ 28、枠と ✓ で選択中を示す）、StatusBadge は押せない（高さ 20、枠なし）。
 * DADS に該当なし（ChipLabel は表示専用）。選択中は色に加えて ✓ を出す。
 */
export function FilterChip({ pressed, onPressedChange, children, count, className, onClick, type = "button", ...rest }: FilterChipProps) {
  return (
    <button
      type={type}
      data-ui="button"
      aria-pressed={pressed}
      onClick={(e) => {
        onPressedChange(!pressed);
        onClick?.(e);
      }}
      className={cx(
        "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-dns-13N-130 whitespace-nowrap",
        "border-border-input bg-surface text-fg-body can-hover:bg-hover",
        "aria-pressed:border-accent aria-pressed:bg-selected aria-pressed:text-fg",
        className,
      )}
      {...rest}
    >
      {pressed && (
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" className="text-accent">
          <path d="m3.5 8.2 3 3 6-6.4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
      <span>{children}</span>
      {count !== undefined && <span className="tabular-nums text-fg-muted">{count}</span>}
    </button>
  );
}
