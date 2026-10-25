import type { ReactNode, SVGProps } from "react";
import { cx } from "./cx.ts";
import { EVAL_LABEL, type EvalLevel } from "./eval-level.ts";

export { EVAL_LABEL, evalLevelOf, type EvalLevel } from "./eval-level.ts";

/** 形だけの SVG（▲ / ◆ / ●✓）。タイムラインの SVG 内でも <g> に入れて使えるよう、fill は currentColor */
export function EvalGlyph({ level, size = 12, ...rest }: { level: EvalLevel; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" width={size} height={size} {...rest}>
      {level === "major" && <path d="M6 .8 11.6 11H.4Z" fill="currentColor" />}
      {level === "minor" && <path d="M6 .4 11.6 6 6 11.6.4 6Z" fill="currentColor" />}
      {level === "good" && (
        <>
          <circle cx="6" cy="6" r="5.6" fill="currentColor" />
          <path d="m3.3 6.2 1.8 1.8 3.6-3.8" fill="none" stroke="var(--bg-surface)" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

const markColor: Record<EvalLevel, string> = {
  major: "text-eval-major",
  minor: "text-eval-minor",
  good: "text-eval-good",
};
const fgColor: Record<EvalLevel, string> = {
  major: "text-eval-major-fg",
  minor: "text-eval-minor-fg",
  good: "text-eval-good-fg",
};

export type EvalMarkProps = {
  level: EvalLevel;
  kind?: "feedback" | "requirement";
  /** 読み上げ・表示の語を差し替える */
  label?: string;
  /** 文字も見せる（既定は図形だけ＋sr-only の語） */
  showLabel?: boolean;
  size?: number;
  className?: string;
};

/**
 * 評価のマーク。DADS に該当なし（LCI 拡張、04 §3.2）。
 * 図形は --eval-*（surface 上で 3:1）、見せる文字は --eval-*-fg（4.5:1）。
 * 図形を描くのは --bg-surface / --bg-raised の上だけ（light の canvas 上では minor が 3:1 を割る）。
 */
export function EvalMark({ level, kind = "feedback", label, showLabel, size = 12, className }: EvalMarkProps) {
  const text = label ?? EVAL_LABEL[kind][level];
  return (
    <span className={cx("inline-flex items-center gap-1 align-middle", className)}>
      <EvalGlyph level={level} size={size} className={cx("shrink-0", markColor[level])} />
      {showLabel ? <span className={cx("text-dns-13N-130", fgColor[level])}>{text}</span> : <span className="sr-only">{text}</span>}
    </span>
  );
}

const chipClass: Record<EvalLevel, string> = {
  major: "bg-eval-major-subtle text-eval-major-fg border-eval-major",
  minor: "bg-eval-minor-subtle text-eval-minor-fg border-eval-minor",
  good: "bg-eval-good-subtle text-eval-good-fg border-eval-good",
};

/**
 * 評価のチップ（表示専用）。DADS ChipLabel filled-1 の構造: 枠 = mark 色、地 = -subtle、文字と図形 = -fg。
 * children で語を差し替えられる（例「▲① 重大」のように番号を足す）。
 */
export function EvalChip({ level, kind = "feedback", children, className }: { level: EvalLevel; kind?: "feedback" | "requirement"; children?: ReactNode; className?: string }) {
  return (
    <span
      data-ui="chip"
      className={cx("inline-flex h-5 shrink-0 items-center gap-1 rounded-4 border px-1.5 text-dns-13N-130 whitespace-nowrap align-middle", chipClass[level], className)}
    >
      <EvalGlyph level={level} size={10} />
      <span>{children ?? EVAL_LABEL[kind][level]}</span>
    </span>
  );
}
