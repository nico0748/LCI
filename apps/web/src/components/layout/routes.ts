/**
 * グローバルヘッダの表示とナビの現在地。純関数（routes.test.ts）。
 */

export const NAV_ITEMS = [
  { href: "/", label: "ホーム" },
  { href: "/problems", label: "問題" },
  { href: "/sessions", label: "履歴" },
] as const;

/**
 * 面接画面（app/(session)/session/[id]）か。面接画面は独自の 40px ヘッダを持ち、
 * テーマ切替もセッション中は出さない（X11）ので、グローバルヘッダとフッタを描かない。
 * 事前確認（/session/new）は通常の画面として扱う。
 */
export function isInterviewRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const m = pathname.match(/^\/session\/([^/]+)\/?$/);
  return m !== null && m[1] !== "new";
}

/** ナビ項目が現在地か（ホームは完全一致、それ以外は配下も含む。事前確認は「問題」の配下とみなす） */
export function isNavCurrent(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  if (href === "/problems" && pathname.startsWith("/session/new")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}
