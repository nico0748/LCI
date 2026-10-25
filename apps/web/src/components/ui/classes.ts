/**
 * 部品の見た目のクラス文字列（"use client" を付けないモジュールに置く: サーバコンポーネントからも値として使えるように）。
 */
import { cx } from "./cx.ts";

const base =
  "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none border underline-offset-[3px] " +
  "aria-disabled:cursor-not-allowed forced-colors:border-[ButtonText]";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "danger-outline";
/** md 36 / sm 32（既定）/ xs 28（面接ヘッダ）/ 2xs 24（行内、2.5.8 の下限） */
export type ButtonSize = "md" | "sm" | "xs" | "2xs";

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-on-accent can-hover:bg-accent-hover can-active:bg-accent-active " +
    "aria-disabled:bg-disabled aria-disabled:text-fg-disabled",
  secondary:
    "border-border-input bg-surface text-fg-body can-hover:bg-hover can-active:bg-selected " +
    "aria-disabled:border-border aria-disabled:bg-surface aria-disabled:text-fg-disabled",
  tertiary:
    "border-transparent bg-transparent text-link can-hover:underline can-hover:bg-hover can-active:bg-selected " +
    "aria-disabled:text-fg-disabled",
  danger:
    "border-transparent bg-danger text-on-danger can-hover:bg-danger-hover " +
    "aria-disabled:bg-disabled aria-disabled:text-fg-disabled",
  "danger-outline":
    "border-danger bg-surface text-danger can-hover:bg-danger-subtle " +
    "aria-disabled:border-border aria-disabled:text-fg-disabled",
};

export const buttonSizeClass: Record<ButtonSize, string> = {
  md: "min-h-9 px-4 rounded-6 text-oln-16B-100",
  sm: "min-h-8 px-3 rounded-6 text-oln-14B-100",
  xs: "min-h-7 px-2 rounded-4 text-oln-14B-100",
  "2xs": "min-h-6 px-1.5 rounded-4 text-dns-13N-130",
};

/** Button と同じ見た目を他の要素（Link など）に付けるためのクラス */
export function buttonClasses({ variant = "secondary", size = "sm" }: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return cx(base, buttonVariantClass[variant], buttonSizeClass[size]);
}

/** タブの見た目: 高さ 32、下辺 2px の accent バー、選択中も太字にしない（01 §2.3）。文字の大きさは含めないので text-dns-14N-130 か text-mono-13N-150 を足す */
export const tabClass =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 px-3 text-fg-muted whitespace-nowrap focus-ring-inset " +
  "can-hover:text-fg can-hover:bg-hover aria-selected:text-fg " +
  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent aria-selected:after:bg-accent " +
  "forced-colors:aria-selected:after:bg-[Highlight]";

export const tabListClass = "flex items-stretch gap-0 border-b border-border overflow-x-auto";

/** 行全体をリンクにする <a> 用のクラス（<Tr interactive> と併用）。フォーカスは行の内側リング */
export const tableRowLinkClass =
  "text-fg no-underline can-hover:underline after:absolute after:inset-0 after:content-[''] " +
  "focus-visible:outline-none focus-visible:shadow-none focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-focus-outer";
