import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCI — ライブコーディング面接トレーナー",
  description: "説明しながらコーディングする面接を、ひとりで練習して振り返るためのローカルアプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)]">{children}</body>
    </html>
  );
}
