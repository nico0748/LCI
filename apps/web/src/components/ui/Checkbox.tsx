"use client";

import type { InputHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cx } from "./cx.ts";

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "disabled" | "size"> & {
  /** ラベル（必須。ラベルの無いチェックボックスは作らない） */
  children: ReactNode;
  /** ラベルの下に出す補足 */
  hint?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
};

const inputClass =
  "mt-[1px] size-4 shrink-0 accent-[var(--accent)] cursor-pointer " +
  "aria-disabled:cursor-not-allowed aria-disabled:accent-[var(--fg-disabled)] aria-invalid:outline aria-invalid:outline-2 aria-invalid:outline-danger";

function Choice({ type, children, hint, disabled, invalid, className, onClick, ...rest }: ChoiceProps & { type: "checkbox" | "radio" }) {
  const handleClick = (e: MouseEvent<HTMLInputElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return (
    <label
      className={cx(
        "inline-flex min-h-6 items-start gap-2 py-1 text-dns-14N-130 text-fg-body cursor-pointer",
        disabled && "cursor-not-allowed text-fg-disabled",
        className,
      )}
    >
      <input
        type={type}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        onClick={handleClick}
        className={inputClass}
        {...rest}
      />
      <span className="flex flex-col gap-0.5">
        <span>{children}</span>
        {hint && <span className="text-dns-13N-130 text-fg-muted">{hint}</span>}
      </span>
    </label>
  );
}

export type CheckboxProps = ChoiceProps;

/**
 * チェックボックス。DADS `Checkbox` の構造（label で包む、aria-disabled、エラー時は danger）に倣い、
 * 描画はネイティブの input に accent-color を当てる（強制カラー・ダークに自動で追従するため）。
 * 当たり判定はラベル全体で 24px 以上。
 */
export function Checkbox(props: CheckboxProps) {
  return <Choice type="checkbox" {...props} />;
}

export type RadioProps = ChoiceProps;

/** ラジオボタン。DADS `Radio`。グループは <fieldset> と <legend> で包む（RadioGroup） */
export function Radio(props: RadioProps) {
  return <Choice type="radio" {...props} />;
}

export type RadioGroupProps = {
  legend: ReactNode;
  /** legend を視覚的に隠す（ヘッダの切替など、周囲から意味が明らかな場合だけ） */
  legendHidden?: boolean;
  hint?: ReactNode;
  orientation?: "vertical" | "horizontal";
  children: ReactNode;
  className?: string;
};

/** ラジオ・チェックボックスのグループ。DADS の Fieldset パターン */
export function ChoiceGroup({ legend, legendHidden, hint, orientation = "vertical", children, className }: RadioGroupProps) {
  return (
    <fieldset className={cx("min-w-0 border-0 p-0 m-0", className)}>
      <legend className={cx("mb-1 text-dns-14B-130 text-fg", legendHidden && "sr-only")}>{legend}</legend>
      {hint && <p className="mb-1 text-dns-13N-130 text-fg-muted">{hint}</p>}
      <div className={cx("flex", orientation === "vertical" ? "flex-col gap-0.5" : "flex-wrap gap-x-4 gap-y-1")}>{children}</div>
    </fieldset>
  );
}
