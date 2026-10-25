import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFooter, AppHeader, MAIN_CONTENT_ID } from "@/components/layout/AppHeader.tsx";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCI — ライブコーディング面接トレーナー",
  description: "説明しながらコーディングする面接を、ひとりで練習して振り返るためのローカルアプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme は初期化スクリプトが描画前に付けるので、サーバの HTML と食い違ってよい
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 保存済みのテーマを描画前に反映し、ライト→ダークのちらつきを防ぐ（X11） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-fg-body font-sans">
        {/* 面接画面（/session/<id>）では AppHeader / AppFooter は何も描かない */}
        <AppHeader />
        <div id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none focus-visible:shadow-none">
          {children}
        </div>
        <AppFooter />
      </body>
    </html>
  );
}
