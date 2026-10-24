/**
 * Monaco は public/monaco/vs からローカル配信する（postinstall で node_modules からコピー）。
 * CDN に依存すると、オフラインやプロキシ環境でエディタが開かず練習自体ができなくなるため。
 */
export const MONACO_VS_PATH = "/monaco/vs";

export async function loadMonacoReact() {
  const m = await import("@monaco-editor/react");
  // Worker 内の fetch は相対 URL を解決できないため、オリジン付きの絶対 URL で渡す
  const base = typeof window === "undefined" ? MONACO_VS_PATH : new URL(MONACO_VS_PATH, window.location.origin).href;
  m.loader.config({ paths: { vs: base } });
  return m;
}
