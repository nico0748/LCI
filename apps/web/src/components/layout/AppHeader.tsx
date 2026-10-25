"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx.ts";
import { ThemeSwitch } from "./ThemeSwitch.tsx";
import { NAV_ITEMS, isInterviewRoute, isNavCurrent } from "./routes.ts";

export const MAIN_CONTENT_ID = "main-content";

/** ロゴマーク: 角括弧と発話の点（等幅の「説明しながら書く」）。装飾なので aria-hidden */
function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" className="shrink-0 text-accent">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="currentColor" />
      <path d="M9 7 5.5 12 9 17M15 7l3.5 5-3.5 5" fill="none" stroke="var(--fg-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.6" fill="var(--fg-on-accent)" />
    </svg>
  );
}

/**
 * グローバルヘッダ（56px）。ロゴ・ナビ（ホーム / 問題 / 履歴、aria-current）・テーマ切替。
 * 面接画面（/session/<id>）では何も描かない（独自ヘッダを持つため）。スキップリンクもここに置く。
 */
export function AppHeader() {
  const pathname = usePathname();
  if (isInterviewRoute(pathname)) return null;
  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only-focusable fixed left-2 top-2 z-50 rounded-6 bg-raised px-3 py-2 text-dns-14B-130 text-link shadow-1"
      >
        本文へ移動
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 desktop:gap-6 desktop:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-4 text-fg no-underline">
            <LogoMark />
            <span className="text-oln-16B-100">LCI</span>
            <span className="hidden text-dns-13N-130 text-fg-muted desktop:inline">ライブコーディング面接トレーナー</span>
          </Link>
          <nav aria-label="メイン" className="min-w-0 flex-1">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const current = isNavCurrent(item.href, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cx(
                        "relative inline-flex h-14 items-center px-2 text-dns-14N-130 no-underline desktop:px-3",
                        "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5",
                        current ? "text-fg after:bg-accent" : "text-fg-muted can-hover:text-fg can-hover:underline underline-offset-[3px]",
                        "focus-ring-inset",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeSwitch />
        </div>
      </header>
    </>
  );
}

/** フッタ: スタイルガイドへの小さなリンクだけ（ほかの画面からは辿らせない） */
export function AppFooter() {
  const pathname = usePathname();
  if (isInterviewRoute(pathname)) return null;
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="mx-auto flex h-10 max-w-[1200px] items-center justify-end px-4 desktop:px-6">
        <Link href="/design" className="text-dns-13N-130 text-fg-muted underline underline-offset-[3px] focus-text">
          デザインシステム
        </Link>
      </div>
    </footer>
  );
}
