import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx.ts";

export type ControlSize = "md" | "sm";

/**
 * 入力欄に共通の見た目。DADS `Input` / `Textarea` / `Select` から:
 * 枠 gray-600 相当（--border-input）、hover で濃く、aria-invalid で danger、読み取り専用は破線、
 * フォーカスは :focus で二重リング（globals.css の base）。高さは LCI の密度（md 36 / sm 32）。
 */
export const controlClass =
  "w-full rounded-6 border text-dns-14N-130 placeholder:text-fg-muted " +
  "aria-invalid:border-danger aria-invalid:border-2 forced-colors:border-[ButtonText]";

/** 状態ごとの面と枠（同じプロパティのユーティリティを重ねないよう、状態で 1 つだけ選ぶ） */
export function controlStateClass({ disabled, readOnly }: { disabled?: boolean; readOnly?: boolean }): string {
  if (disabled) return "cursor-not-allowed border-border bg-disabled text-fg-disabled";
  if (readOnly) return "border-dashed border-border-input bg-canvas text-fg-body";
  return "border-border-input bg-surface text-fg-body can-hover:border-fg";
}

const heightClass: Record<ControlSize, string> = {
  md: "min-h-9 px-3",
  sm: "min-h-8 px-2.5",
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "disabled"> & {
  size?: ControlSize;
  /** aria-disabled で無効にする（値は読み上げられ、フォーカスも残る）。入力は readOnly で止める */
  disabled?: boolean;
};

/** 1 行の入力欄。DADS `Input`。ラベルは Field で付ける（プレースホルダをラベル代わりにしない） */
export function Input({ size = "sm", disabled, className, readOnly, ...rest }: InputProps) {
  return (
    <input
      aria-disabled={disabled || undefined}
      readOnly={readOnly || disabled}
      className={cx(controlClass, controlStateClass({ disabled, readOnly }), heightClass[size], className)}
      {...rest}
    />
  );
}

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "disabled"> & { disabled?: boolean };

/** 複数行の入力欄。DADS `Textarea`。等幅にしたいとき（stdin など）は className に font-mono を足す */
export function Textarea({ disabled, className, readOnly, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-disabled={disabled || undefined}
      readOnly={readOnly || disabled}
      className={cx(controlClass, controlStateClass({ disabled, readOnly }), "px-2.5 py-2 text-std-14N-170 resize-y", className)}
      {...rest}
    />
  );
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: ControlSize };

/**
 * ネイティブの <select>。DADS `Select` の矢印は data URI に黒を埋め込んでいてダークで消えるので、
 * currentColor の SVG を重ねて描く。値を「カテゴリ: すべて」のようにラベル込みで表示しない（ラベルは Field）。
 */
export function Select({ size = "sm", className, children, ...rest }: SelectProps) {
  return (
    <span className={cx("relative inline-flex w-full text-fg-body", className)}>
      <select className={cx(controlClass, controlStateClass({}), heightClass[size], "appearance-none pr-8")} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted"
      >
        <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  );
}
