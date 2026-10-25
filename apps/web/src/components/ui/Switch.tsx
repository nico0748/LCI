"use client";

import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx.ts";

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "disabled"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 見えるラベル（スイッチの右に置く） */
  children: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
};

/**
 * オン・オフの切替（即時に効く設定に使う。送信を待つ選択には Checkbox）。DADS `SwitchOnOff`:
 * role="switch" + aria-checked、オンの時は ✓ を thumb に描いて色以外でも状態を示す。
 * LCI 版は高さ 20 の小型。thumb の移動にアニメーションを付けない。
 */
export function Switch({ checked, onCheckedChange, children, hint, disabled, className, id, ...rest }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const hintId = hint ? `${switchId}-hint` : undefined;
  return (
    <span className={cx("inline-flex items-start gap-2", className)}>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-describedby={hintId}
        onClick={() => {
          if (!disabled) onCheckedChange(!checked);
        }}
        className={cx(
          "group relative mt-[-1px] inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 p-0.5",
          "border-border-input bg-surface aria-checked:border-accent aria-checked:bg-accent",
          "aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:bg-disabled",
          "forced-colors:border-[ButtonText] forced-colors:aria-checked:border-[Highlight]",
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cx(
            "grid size-3 place-items-center rounded-full bg-fg-muted",
            "group-aria-checked:ml-auto group-aria-checked:bg-on-accent",
            "group-aria-disabled:bg-fg-disabled forced-colors:bg-[ButtonText] forced-colors:group-aria-checked:bg-[Highlight]",
          )}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" className="hidden text-accent group-aria-checked:block">
            <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
      </button>
      <span className="flex flex-col gap-0.5">
        <label htmlFor={switchId} className={cx("text-dns-14N-130 text-fg-body cursor-pointer", disabled && "text-fg-disabled cursor-not-allowed")}>
          {children}
        </label>
        {hint && (
          <span id={hintId} className="text-dns-13N-130 text-fg-muted">
            {hint}
          </span>
        )}
      </span>
    </span>
  );
}
