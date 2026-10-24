import Link from "next/link";
import { LANGUAGE_LABEL, Language } from "@lci/core";
import { problem } from "@/lib/server";
import { PreflightScreenClient as PreflightScreen } from "@/components/session/client";

export const dynamic = "force-dynamic";

/** S2 ブリーフィング: /session/new?problem=<id>&lang=<lang> */
export default async function NewSessionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = typeof sp.problem === "string" ? sp.problem : "";
  const p = id ? await problem(id) : undefined;
  if (!p) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 space-y-3">
        <h1 className="text-lg font-semibold">問題が見つかりません</h1>
        <Link href="/problems" className="text-accent text-sm">問題一覧へ戻る</Link>
      </main>
    );
  }
  const requested = Language.safeParse(sp.lang);
  const language = requested.success && p.meta.languages.includes(requested.data) ? requested.data : p.meta.languages[0]!;
  return (
    <PreflightScreen
      problemId={p.meta.id}
      title={p.meta.title}
      timeLimitMin={p.meta.time_limit}
      language={language}
      languageLabel={LANGUAGE_LABEL[language]}
      kind={p.tests.kind}
      hasFollowups={p.meta.followups.length > 0}
      defaultMode={p.meta.interviewer_mode}
    />
  );
}
