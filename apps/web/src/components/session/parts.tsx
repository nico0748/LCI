"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Kbd, NotificationBanner, buttonSizeClass, cx } from "@/components/ui";
import { INTERVIEW_MIN_WIDTH } from "./useWideEnough.ts";

/**
 * 面接ヘッダの「終了…」用の無彩色テキストボタン（03 §3.5、DESIGN_SYSTEM §7）。
 * Button の tertiary はリンク色なので使わない（ヘッダの色は録画停止の赤と accent のフォーカスだけにする）。
 * 寸法は Button の xs（28px）と同じ。無効は aria-disabled。
 */
export function QuietButton({
  kbd,
  keyshortcuts,
  disabled,
  className,
  children,
  onClick,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & { kbd?: string; keyshortcuts?: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      data-ui="button"
      aria-disabled={disabled || undefined}
      aria-keyshortcuts={keyshortcuts}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cx(
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none border border-transparent underline-offset-[3px]",
        buttonSizeClass.xs,
        "bg-transparent text-fg-body can-hover:bg-hover can-hover:underline can-active:bg-selected",
        "aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled forced-colors:border-[ButtonText]",
        className,
      )}
      {...rest}
    >
      {children}
      {kbd && <Kbd aria-hidden="true">{kbd}</Kbd>}
    </button>
  );
}

/** 1280px 未満で開始させないときの案内（X13） */
export function NarrowNotice({ className }: { className?: string }) {
  return (
    <NotificationBanner tone="warning" title="PC で開始してください" className={className}>
      面接画面は幅 {INTERVIEW_MIN_WIDTH}px 以上で使います（問題・エディタ・プレビューを並べるため）。ウィンドウを広げるか、PC のブラウザで開いてください。
    </NotificationBanner>
  );
}

/** 状態リストの図形（◌ 確認中・待機）。✓！✕ は ui の SYSTEM_ICON を使う */
export function PendingIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width={size} height={size}>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2.2" />
    </svg>
  );
}
