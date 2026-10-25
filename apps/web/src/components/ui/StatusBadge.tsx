import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";
import { SYSTEM_ICON, type SystemTone } from "./icons.tsx";

export type ChipTone = "neutral" | SystemTone;

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** システム状態の種類（X2）。評価結果には EvalChip を使う（X1） */
  tone?: ChipTone;
  /**
   * filled = *-subtle の地に状態色の文字（DADS ChipLabel filled-1）。状態（AC / 実行環境なし など）
   * outlined = 枠だけ（カテゴリ、「自動生成」）
   * text = 地も枠も無し（難易度 L1–L4 など）
   */
  variant?: "filled" | "outlined" | "text";
  /** 形のグリフを出す（既定: neutral 以外は出す）。色だけに頼らないため、状態を表すなら消さない */
  glyph?: boolean;
  /** ID や難易度コードを等幅で出す */
  mono?: boolean;
  children: ReactNode;
};

const filled: Record<ChipTone, string> = {
  neutral: "bg-hover text-fg-body",
  info: "bg-info-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};
const outlined: Record<ChipTone, string> = {
  neutral: "border-border-strong text-fg-body",
  info: "border-info text-accent",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
};
const textOnly: Record<ChipTone, string> = {
  neutral: "text-fg-muted",
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * 状態チップ（表示専用。押せない）。DADS `ChipLabel` を高さ 20・角丸 4・13px に詰めたもの。
 * 押して絞り込む用途には FilterChip を使う（見た目が似ていても役割が違う）。
 * 文字を必ず入れる（色・形だけで状態を示さない）。
 */
export function StatusBadge({ tone = "neutral", variant = "filled", glyph, mono, className, children, ...rest }: StatusBadgeProps) {
  const showGlyph = glyph ?? tone !== "neutral";
  const Icon = tone === "neutral" ? null : SYSTEM_ICON[tone];
  return (
    <span
      data-ui="chip"
      className={cx(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-4 border whitespace-nowrap align-middle",
        variant === "text" ? "px-0" : "px-1.5",
        mono ? "text-mono-12N-120" : "text-dns-13N-130",
        variant === "filled" && cx("border-transparent", filled[tone]),
        variant === "outlined" && cx("bg-transparent", outlined[tone]),
        variant === "text" && cx("border-transparent", textOnly[tone]),
        className,
      )}
      {...rest}
    >
      {showGlyph && Icon && <Icon size={12} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** 01 の呼び名に合わせた別名 */
export const Chip = StatusBadge;
