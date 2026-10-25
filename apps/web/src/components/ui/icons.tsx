/**
 * 状態を示す図形（色だけに頼らないための形）。すべて currentColor・aria-hidden。
 * システム状態（X2）: info ⓘ / success ✓ / warning ！ / danger ✕
 * 評価（X1）: major ▲ / minor ◆ / good ●✓（EvalMark.tsx）
 */
import type { SVGProps } from "react";

export type SystemTone = "info" | "success" | "warning" | "danger";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const svg = (size: number, rest: SVGProps<SVGSVGElement>) => ({
  "aria-hidden": true as const,
  viewBox: "0 0 16 16",
  width: size,
  height: size,
  focusable: "false" as const,
  ...rest,
});

/** 円の中に i */
export function InfoIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, rest)}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 7v4.5M8 4.2v.1" stroke="var(--bg-surface)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 円の中に ✓ */
export function SuccessIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, rest)}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="m4.6 8.2 2.3 2.3 4.5-4.8" fill="none" stroke="var(--bg-surface)" strokeWidth="1.8" />
    </svg>
  );
}

/** 三角の中に ！ */
export function WarningIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, rest)}>
      <path d="M8 1.2 15.2 14.3H.8Z" fill="currentColor" />
      <path d="M8 6v4M8 12v.1" stroke="var(--bg-surface)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 八角形の中に ✕（停止の形） */
export function DangerIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, rest)}>
      <path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1Z" fill="currentColor" />
      <path d="m5.5 5.5 5 5m0-5-5 5" stroke="var(--bg-surface)" strokeWidth="1.8" />
    </svg>
  );
}

export const SYSTEM_ICON = { info: InfoIcon, success: SuccessIcon, warning: WarningIcon, danger: DangerIcon } as const;

/** 読み上げ用の名前（DADS NotificationBanner の aria-label と同じ語） */
export const SYSTEM_TONE_LABEL: Record<SystemTone, string> = {
  info: "情報",
  success: "成功",
  warning: "警告",
  danger: "エラー",
};

/** 閉じる ✕ */
export function CloseIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...svg(size, rest)}>
      <path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
