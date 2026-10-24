import Link from "next/link";
import { CATEGORY_LABEL, countByCategory, toSummary } from "@lci/core";
import { problems, store } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ps = await problems();
  const counts = countByCategory(ps);
  const sessions = (await store().list()).slice(0, 5);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">LCI — ライブコーディング面接トレーナー</h1>
        <p className="text-fg-muted">説明しながら書く。終わったら、話したことと書いたことを突き合わせて振り返る。</p>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">問題を選ぶ</h2>
          <Link href="/problems" className="text-accent text-sm">すべての問題 →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((c) => (
            <Link key={c} href={`/problems?category=${c}`} className="rounded-lg border border-border bg-bg-elev p-4 hover:border-accent transition-colors">
              <div className="text-xs text-fg-muted font-mono">{c}</div>
              <div className="font-medium">{CATEGORY_LABEL[c]}</div>
              <div className="text-sm text-fg-muted mt-1">{counts[c]} 問</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">最近のセッション</h2>
          <Link href="/sessions" className="text-accent text-sm">履歴 →</Link>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-fg-muted">まだセッションがありません。問題を選んで始めてください。</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-bg-elev">
            {sessions.map((s) => (
              <li key={s.session_id}>
                <Link href={`/sessions/${s.session_id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
                  <span>{s.problem.title}</span>
                  <span className="text-xs text-fg-muted font-mono">{s.status} · {new Date(s.started_at_wall).toLocaleString("ja-JP")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-fg-muted">{ps.map(toSummary).length} 問を読み込み済み。問題は <code className="font-mono">problems/</code>、記録は <code className="font-mono">data/sessions/</code> に保存されます。</p>
    </main>
  );
}
