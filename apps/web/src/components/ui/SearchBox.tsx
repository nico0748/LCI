"use client";

import { forwardRef, useId, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx.ts";
import { controlClass, controlStateClass } from "./Input.tsx";
import { Kbd } from "./Kbd.tsx";

export type SearchBoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** 見えるラベル（既定「検索」）。プレースホルダには例だけを書く */
  label?: ReactNode;
  labelHidden?: boolean;
  /** 入力欄の右に出すショートカットの案内（例 "/"）。キーの処理は画面側で行う */
  shortcutHint?: string;
  /** 結果件数などの補足（aria-describedby で読む） */
  hint?: ReactNode;
  clearLabel?: string;
};

/**
 * 即時絞り込みの検索欄。DADS `SearchBox` から: 虫眼鏡は aria-hidden、ブラウザの × は消す、
 * role="search" で囲む。LCI では送信ボタンを置かない（打つたびに絞り込む）。
 * 値があるときだけ「消去」ボタンを出し、押したら入力欄にフォーカスを戻す。Esc でも消せる。
 */
export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onValueChange, label = "検索", labelHidden, shortcutHint, hint, clearLabel = "検索語を消去", className, id, onKeyDown, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!, []);
  return (
    <div role="search" className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className={cx("text-dns-14B-130 text-fg", labelHidden && "sr-only")}>
        {label}
      </label>
      <div className="relative flex items-center">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className="pointer-events-none absolute left-2.5 text-fg-muted">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          aria-describedby={hintId}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onValueChange("");
            }
            onKeyDown?.(e);
          }}
          className={cx(controlClass, controlStateClass({}), "min-h-8 pl-8", value ? "pr-9" : shortcutHint ? "pr-8" : "pr-2.5")}
          {...rest}
        />
        {value ? (
          <button
            type="button"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={() => {
              onValueChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-1 inline-flex size-6 items-center justify-center rounded-4 text-fg-muted can-hover:bg-hover can-hover:text-fg"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        ) : (
          shortcutHint && (
            <Kbd aria-hidden="true" className="pointer-events-none absolute right-2">
              {shortcutHint}
            </Kbd>
          )
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-dns-13N-130 text-fg-muted" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
});
