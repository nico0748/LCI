import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL, LANGUAGE_LABEL } from "@lci/core";
import { problem } from "@/lib/server";
import { Markdown } from "@/components/review/markdown";
import { StartForm } from "./StartForm";

export const dynamic = "force-dynamic";

/**
 * S2 ブリーフィング。問題文・制約・時間・言語を確認して Enter 1 回で開始する（FR-U-03）。
 * talking_points / requirements / rubric_hints / 面接官メモ / 解説はここでは出さない。
 * レビュー画面で初めて開示する（04 §6.4, FR-U-15）。
 */
export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await problem(id);
  if (!p) notFound();
  const { meta, body } = p;
  const starters = meta.starter_files.map((f) => f.path);
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
      <nav className="text-sm text-fg-muted flex gap-2">
        <Link href="/problems" className="hover:text-fg">問題一覧</Link>
        <span>/</span>
        <span className="font-mono">{meta.id}</span>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <span className="rounded border border-border px-1.5 py-0.5 font-mono">{meta.category}</span>
          <span>{CATEGORY_LABEL[meta.category]}</span>
          <span>·</span>
          <span className="font-mono">{meta.difficulty}</span>
          <span>·</span>
          <span>{meta.time_limit} 分</span>
          {meta.tier !== "core" && (
            <>
              <span>·</span>
              <span className={meta.tier === "draft" ? "text-warn" : ""}>{meta.tier === "generated" ? "自動生成" : "下書き"}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        {(meta.tags.nfr.length > 0 || meta.tags.company_style.length > 0) && (
          <p className="text-xs text-fg-muted">{[...meta.tags.company_style.map((s) => `${s} 形式`), ...meta.tags.nfr].join(" · ")}</p>
        )}
      </header>

      <section className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <article className="rounded-lg border border-border bg-bg-elev p-5 space-y-2">
            <h2 className="text-sm font-semibold text-fg-muted">問題文</h2>
            <Markdown text={body.statement} />
          </article>
          {body.constraints && (
            <article className="rounded-lg border border-border bg-bg-elev p-5 space-y-2">
              <h2 className="text-sm font-semibold text-fg-muted">制約</h2>
              <Markdown text={body.constraints} />
            </article>
          )}
        </div>

        <aside className="space-y-4">
          <StartForm problemId={meta.id} languages={meta.languages} timeLimit={meta.time_limit} />
          <dl className="rounded-lg border border-border bg-bg-elev p-4 text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">制限時間</dt>
              <dd className="font-mono">{meta.time_limit} 分</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">面接官</dt>
              <dd>{meta.interviewer_mode === "silent" ? "無言モード" : "追問あり"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">質問</dt>
              <dd>{meta.allow_questions ? "質問ログに残せる" : "不可"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">Web 検索</dt>
              <dd>{meta.web_search ? "許可" : "なし"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">判定</dt>
              <dd className="font-mono">{p.tests.kind}</dd>
            </div>
            {starters.length > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-fg-muted">スターター</dt>
                <dd className="font-mono text-right">{starters.join(", ")}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-fg-muted">対応言語</dt>
              <dd className="text-right">{meta.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")}</dd>
            </div>
          </dl>
          <p className="text-xs text-fg-muted leading-relaxed">
            開始するとカメラ・マイクの録画と編集ログの記録が始まります。話しながら書いてください。面接官メモ・隠しテスト・解説は終了後のレビューで開示されます。
          </p>
        </aside>
      </section>
    </main>
  );
}
