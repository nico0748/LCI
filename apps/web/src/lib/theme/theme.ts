/**
 * テーマ（自動 / ライト / ダーク）の解決と保存（X11）。
 * - 「自動」は <html> に data-theme を付けない（globals.css の prefers-color-scheme が効く）。
 * - ライト / ダークは <html data-theme="light|dark">。
 * - 保存先は localStorage。読み書きできない環境（プライベートモード等）でも落とさない。
 * DOM に触る関数は呼び出し側（クライアント）でだけ使う。純粋な部分は theme.test.ts で検査する。
 */
import type { ThemeMode } from "./tokens.ts";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "lci-theme";

export const THEME_PREFERENCES: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "自動" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ThemeMode {
  if (pref === "light" || pref === "dark") return pref;
  return systemPrefersDark ? "dark" : "light";
}

/** <html> の data-theme 属性（無ければ null）と OS 設定から、いま表示しているモードを返す */
export function resolveThemeFromAttribute(attr: string | null | undefined, systemPrefersDark: boolean): ThemeMode {
  return resolveTheme(parseThemePreference(attr), systemPrefersDark);
}

/**
 * ハイドレーション前に <head> で実行するスクリプト。保存済みの設定を data-theme に反映して、
 * 初回描画でライト→ダークがちらつくのを防ぐ。layout.tsx が dangerouslySetInnerHTML で埋め込む。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p==="light"||p==="dark"){document.documentElement.setAttribute("data-theme",p)}}catch(e){}})();`;

export function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** 設定を保存して <html> に反映する */
export function applyThemePreference(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 保存できなくても表示は切り替わっているので続行する
  }
}

/** data-theme と prefers-color-scheme の変化を購読する（useSyncExternalStore 用） */
export function subscribeTheme(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", onChange);
  // 別タブで切り替えたら、このタブの <html> にも反映する（属性の変化は MutationObserver が拾う）
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    const pref = parseThemePreference(e.newValue);
    if (pref === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", pref);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function currentThemeMode(): ThemeMode {
  return resolveThemeFromAttribute(
    document.documentElement.getAttribute("data-theme"),
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

export function currentThemePreference(): ThemePreference {
  return parseThemePreference(document.documentElement.getAttribute("data-theme"));
}
