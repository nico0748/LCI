"use client";

import { useId, useSyncExternalStore } from "react";
import { cx } from "@/components/ui/cx.ts";
import {
  THEME_PREFERENCES,
  applyThemePreference,
  currentThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme/theme.ts";

const serverSnapshot = (): ThemePreference => "system";

/**
 * テーマ切替（自動 / ライト / ダーク、X11）。ラジオボタンの segmented 表示。
 * 値は <html data-theme> から読む（layout.tsx の初期化スクリプトが保存値を描画前に反映している）。
 * セッション中（面接画面）には置かない。
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribeTheme, currentThemePreference, serverSnapshot);
  const name = useId();
  return (
    <fieldset className={cx("m-0 flex min-w-0 items-center border-0 p-0", className)}>
      <legend className="sr-only">テーマ</legend>
      <div className="flex rounded-6 border border-border-input bg-surface p-0.5">
        {THEME_PREFERENCES.map((opt) => (
          <label
            key={opt.value}
            className={cx(
              "relative inline-flex h-6 cursor-pointer items-center rounded-4 px-2 text-dns-13N-130",
              "has-[:checked]:bg-selected has-[:checked]:text-fg has-[:checked]:font-bold",
              "text-fg-muted can-hover:text-fg",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus-outer",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={pref === opt.value}
              onChange={() => applyThemePreference(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
