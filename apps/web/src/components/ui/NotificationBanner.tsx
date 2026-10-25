"use client";

import type { ReactNode } from "react";
import { cx } from "./cx.ts";
import { CloseIcon, SYSTEM_ICON, SYSTEM_TONE_LABEL, type SystemTone } from "./icons.tsx";

export type NotificationBannerProps = {
  tone: SystemTone;
  /**
   * standard = 枠 1px・地は *-subtle・見出し付き（ページ内の注意、評価失敗、事前確認の不足）。
   * compact = 高さ 32 の 1 行、左に 4px の帯（面接中の録画停止・保存失敗。DADS color-chip の文法）。
   */
  variant?: "standard" | "compact";
  title?: ReactNode;
  /** 見出しのレベル（standard の title） */
  headingLevel?: 2 | 3 | 4;
  children?: ReactNode;
  /** 再試行などの操作（Button size="xs"/"sm"） */
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  /**
   * 読み上げ。既定は danger が "alert"（割り込んで読む）、それ以外は "status"（区切りで読む）。
   * ページを開いた時点で既にあるバナーで読み上げが不要なら "off"。
   */
  live?: "status" | "alert" | "off";
  className?: string;
};

const toneClass: Record<SystemTone, { border: string; bg: string; band: string; icon: string }> = {
  info: { border: "border-info", bg: "bg-info-subtle", band: "border-l-info", icon: "text-info" },
  success: { border: "border-success", bg: "bg-success-subtle", band: "border-l-success", icon: "text-success" },
  warning: { border: "border-warning", bg: "bg-warning-subtle", band: "border-l-warning", icon: "text-warning" },
  danger: { border: "border-danger", bg: "bg-danger-subtle", band: "border-l-danger", icon: "text-danger" },
};

/**
 * 通知バナー。DADS `NotificationBanner`（info1/warning/error/success、アイコンに role=img と aria-label）。
 * DADS は role を持たないので LCI 版で live を付ける。自動では消さない。
 * 文字は --fg-body（*-subtle の地に --fg-muted を置くと dark で 4.5:1 を割る）。
 * 色・図形（ⓘ✓！✕）・文字の 3 つで種類を示す。
 */
export function NotificationBanner({
  tone,
  variant = "standard",
  title,
  headingLevel = 3,
  children,
  actions,
  onClose,
  closeLabel = "閉じる",
  live,
  className,
}: NotificationBannerProps) {
  const Icon = SYSTEM_ICON[tone];
  const liveMode = live ?? (tone === "danger" ? "alert" : "status");
  const role = liveMode === "off" ? undefined : liveMode;
  const t = toneClass[tone];
  const icon = (
    <span role="img" aria-label={SYSTEM_TONE_LABEL[tone]} className={cx("inline-flex shrink-0", t.icon)}>
      <Icon />
    </span>
  );
  const close = onClose && (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-4 px-1.5 text-dns-13N-130 text-fg-body can-hover:underline"
    >
      <CloseIcon size={14} />
      {closeLabel}
    </button>
  );

  if (variant === "compact") {
    return (
      <div
        role={role}
        data-ui="banner"
        className={cx(
          "flex min-h-8 items-center gap-2 border border-transparent border-l-4 px-3 py-1 text-dns-14N-130 text-fg-body",
          t.band,
          t.bg,
          className,
        )}
      >
        {icon}
        <div className="min-w-0 flex-1">
          {title && <strong className="mr-2 font-bold text-fg">{title}</strong>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        {close}
      </div>
    );
  }

  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div role={role} data-ui="banner" className={cx("flex gap-3 rounded-8 border p-3", t.border, t.bg, className)}>
      <div className="pt-0.5">{icon}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && <H className="text-dns-16B-130 text-fg">{title}</H>}
        {children && <div className="text-std-14N-170 text-fg-body">{children}</div>}
        {actions && <div className="mt-1 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {close && <div className="shrink-0">{close}</div>}
    </div>
  );
}
