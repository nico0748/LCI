"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cx } from "./cx.ts";
import { Kbd } from "./Kbd.tsx";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./classes.ts";

export type { ButtonSize, ButtonVariant } from "./classes.ts";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** aria-disabled で無効にする（フォーカスは残す）。ネイティブの disabled 属性は使わない */
  disabled?: boolean;
  /**
   * 処理中。ラベルは変えずに静止した「…」を足し、aria-busy と aria-disabled を付ける。
   * `loading` を一度でも渡したボタンは「…」の幅を常に確保するので、切り替えで幅が揺れない（03 §3.5）。
   * スピナーは使わない（面接中は動くものを置かないため。画面外でも統一する）。
   */
  loading?: boolean;
  /** ボタン内に薄く出すショートカットの表記（例 "⌘↵"）。読み上げは keyshortcuts 側で伝える */
  kbd?: string;
  /** aria-keyshortcuts の値（例 "Meta+Enter"） */
  keyshortcuts?: string;
  /** ラベルの前に置くアイコン（16px の SVG、aria-hidden） */
  icon?: ReactNode;
};

/**
 * ボタン。DADS `Button`（solid-fill / outline / text）を LCI の密度に合わせたもの。
 * - primary = DADS solid-fill。1 画面に 1 個まで。
 * - secondary = DADS outline。既定。文字は無彩色。
 * - tertiary = DADS text。リンク色、hover で下線。
 * - danger / danger-outline は DADS に無い LCI 拡張。solid の danger は確認ダイアログ内だけで使う。
 * 無効は aria-disabled（クリックを preventDefault で止める。透明度は使わない）。
 */
export function Button({
  variant = "secondary",
  size = "sm",
  disabled,
  loading,
  kbd,
  keyshortcuts,
  icon,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonProps) {
  const inert = Boolean(disabled || loading);
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <button
      type={type}
      data-ui="button"
      data-variant={variant}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      aria-keyshortcuts={keyshortcuts}
      className={cx(buttonClasses({ variant, size }), className)}
      onClick={handleClick}
      {...rest}
    >
      {icon}
      {children}
      {loading !== undefined && (
        <span aria-hidden="true" className="inline-block w-[1em] text-left">
          {loading ? "…" : ""}
        </span>
      )}
      {kbd && (
        <Kbd aria-hidden="true" tone={variant === "primary" || variant === "danger" ? "on-fill" : "muted"}>
          {kbd}
        </Kbd>
      )}
    </button>
  );
}
