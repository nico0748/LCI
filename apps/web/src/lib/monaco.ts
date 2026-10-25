import { defineLciThemes } from "./monaco-theme.ts";

export { defineLciThemes, useMonacoTheme, MONACO_THEME_NAME, LCI_MONACO_OPTIONS } from "./monaco-theme.ts";
export type { LciMonacoThemeName } from "./monaco-theme.ts";

/**
 * Monaco は public/monaco/vs からローカル配信する（postinstall で node_modules からコピー）。
 * CDN に依存すると、オフラインやプロキシ環境でエディタが開かず練習自体ができなくなるため。
 */
export const MONACO_VS_PATH = "/monaco/vs";

/**
 * @monaco-editor/react を読み込み、ローダの配信元を設定し、lci-light / lci-dark を登録してから返す。
 * テーマの登録を Editor のマウントより前に済ませるので、呼び出し側は `theme="lci-dark"` をそのまま渡せる。
 * Monaco 本体の読み込みに失敗してもここでは握りつぶす（各画面が loader.init() の失敗で代替表示に切り替える）。
 */
export async function loadMonacoReact() {
  const m = await import("@monaco-editor/react");
  // Worker 内の fetch は相対 URL を解決できないため、オリジン付きの絶対 URL で渡す
  const base = typeof window === "undefined" ? MONACO_VS_PATH : new URL(MONACO_VS_PATH, window.location.origin).href;
  m.loader.config({ paths: { vs: base } });
  if (typeof window !== "undefined") {
    try {
      defineLciThemes(await m.loader.init());
    } catch {
      // 失敗時の扱いは呼び出し側（代替表示）に任せる
    }
  }
  return m;
}
