/**
 * Monaco のテーマ lci-light / lci-dark（03 §3.10）。
 * Monaco は CSS 変数を解釈できないので、globals.css の値を静的に写した LCI_TOKENS から組み立てる。
 * 構文の色は base（vs / vs-dark）を引き継ぎ、面・行番号・選択・カーソルだけを LCI に合わせる。
 * セッション中はテーマを切り替えない（04 §7.2）ので、面接画面は開始時の値を固定して渡すこと。
 */
import { useSyncExternalStore } from "react";
import type * as Monaco from "monaco-editor";
import { LCI_TOKENS, PRIMITIVES, FONT_MONO, type ThemeMode } from "./theme/tokens.ts";
import { currentThemeMode, subscribeTheme } from "./theme/theme.ts";

export type LciMonacoThemeName = "lci-light" | "lci-dark";

export const MONACO_THEME_NAME: Record<ThemeMode, LciMonacoThemeName> = {
  light: "lci-light",
  dark: "lci-dark",
};

/** #rrggbb に 2 桁のアルファを付ける */
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

/** defineTheme に渡すデータ（純関数。monaco-theme.test.ts で値を検査する） */
export function buildMonacoTheme(mode: ThemeMode): Monaco.editor.IStandaloneThemeData {
  const t = LCI_TOKENS[mode];
  const dark = mode === "dark";
  return {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": t["bg-surface"],
      "editor.foreground": t.fg,
      "editorGutter.background": t["bg-surface"],
      // 行番号も文字なので surface 上で 4.5:1（light gray-536 4.54 / dark gray-400 6.11）。青緑をやめて無彩色に
      "editorLineNumber.foreground": dark ? PRIMITIVES["dads-gray-400"] : PRIMITIVES["dads-gray-536"],
      "editorLineNumber.activeForeground": t.fg,
      // 現在行は面より 1 段だけ変え、枠線は付けない（選択範囲と混同しないため）
      "editor.lineHighlightBackground": dark ? t["bg-raised"] : t["bg-canvas"],
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": alpha(t.accent, dark ? 0.28 : 0.22),
      "editor.inactiveSelectionBackground": alpha(t.accent, dark ? 0.14 : 0.1),
      "editor.selectionHighlightBackground": alpha(t.accent, dark ? 0.14 : 0.1),
      "editorCursor.foreground": t.fg,
      "editorIndentGuide.background1": t.border,
      "editorIndentGuide.activeBackground1": t["border-strong"],
      "editorWhitespace.foreground": t.border,
      "editorWidget.background": t["bg-raised"],
      "editorWidget.border": t.border,
      "editorSuggestWidget.background": t["bg-raised"],
      "editorSuggestWidget.border": t.border,
      "editorSuggestWidget.selectedBackground": t["bg-selected"],
      "editorHoverWidget.background": t["bg-raised"],
      "editorHoverWidget.border": t.border,
      "focusBorder": t.accent,
      "scrollbarSlider.background": dark ? "#ffffff1f" : "#0000001f",
      "scrollbarSlider.hoverBackground": dark ? "#ffffff33" : "#00000033",
      "scrollbarSlider.activeBackground": dark ? "#ffffff47" : "#00000047",
      "scrollbar.shadow": "#00000000",
    },
  };
}

type MonacoLike = { editor: { defineTheme: (name: string, data: Monaco.editor.IStandaloneThemeData) => void } };

/** lci-light / lci-dark を登録する。何度呼んでもよい（beforeMount に渡しても、loadMonacoReact が呼んでもよい） */
export function defineLciThemes(monaco: MonacoLike): void {
  monaco.editor.defineTheme(MONACO_THEME_NAME.light, buildMonacoTheme("light"));
  monaco.editor.defineTheme(MONACO_THEME_NAME.dark, buildMonacoTheme("dark"));
}

/** Monaco の editor オプションのうち、LCI で揃える見た目（03 §3.10、01 §4.5） */
export const LCI_MONACO_OPTIONS = {
  fontFamily: FONT_MONO,
  fontSize: 14,
  lineHeight: 22,
  cursorBlinking: "solid",
  smoothScrolling: false,
  scrollbar: { horizontalScrollbarSize: 8, verticalScrollbarSize: 10 },
} as const satisfies Monaco.editor.IStandaloneEditorConstructionOptions;

const serverTheme = (): LciMonacoThemeName => "lci-light";
const clientTheme = (): LciMonacoThemeName => MONACO_THEME_NAME[currentThemeMode()];

/**
 * いまのテーマ（<html data-theme> と prefers-color-scheme）に追従する Monaco テーマ名。
 * 面接画面では切り替えないこと: 開始時の値を useState などで固定して使う。
 */
export function useMonacoTheme(): LciMonacoThemeName {
  return useSyncExternalStore(subscribeTheme, clientTheme, serverTheme);
}
