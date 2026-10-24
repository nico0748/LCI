import Link from "next/link";
import { toSummary } from "@lci/core";
import { problems } from "@/lib/server";
import { ProblemBrowser, type BrowserFilters } from "./ProblemBrowser";

export const dynamic = "force-dynamic";

/**
 * S1 問題選択。問題文はここでは見せない（04 §6.1: 初見で要件を読む練習にならない）。
 * フィルタは URL に保持して再現できるようにする（FR-U-02）。
 */
export default async function ProblemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const initial: BrowserFilters = {
    q: one("q"),
    category: one("category"),
    difficulty: one("difficulty"),
    time_limit: one("time_limit"),
    language: one("language"),
    tier: one("tier"),
    nfr: one("nfr"),
  };
  const ps = (await problems()).map(toSummary);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">問題を選ぶ</h1>
          <p className="text-sm text-fg-muted mt-1">
            <kbd className="font-mono text-xs border border-border rounded px-1">/</kbd> 検索 ·{" "}
            <kbd className="font-mono text-xs border border-border rounded px-1">j</kbd>/<kbd className="font-mono text-xs border border-border rounded px-1">k</kbd> 移動 ·{" "}
            <kbd className="font-mono text-xs border border-border rounded px-1">Enter</kbd> 開く
          </p>
        </div>
        <nav className="text-sm flex gap-4">
          <Link href="/" className="text-fg-muted hover:text-fg">ホーム</Link>
          <Link href="/sessions" className="text-fg-muted hover:text-fg">履歴</Link>
        </nav>
      </header>
      <ProblemBrowser problems={ps} initial={initial} />
    </main>
  );
}
