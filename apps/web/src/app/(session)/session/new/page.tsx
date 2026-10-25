import { LANGUAGE_LABEL, Language } from "@lci/core";
import { problem } from "@/lib/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState, LinkButton } from "@/components/ui";
import { PreflightScreenClient as PreflightScreen } from "@/components/session/client";

export const dynamic = "force-dynamic";

/** S2 ブリーフィング: /session/new?problem=<id>&lang=<lang> */
export default async function NewSessionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = typeof sp.problem === "string" ? sp.problem : "";
  const p = id ? await problem(id) : undefined;
  if (!p) {
    return (
      <PageContainer as="main" width="reading">
        <h1 className="sr-only">問題が見つかりません</h1>
        <EmptyState
          title="問題が見つかりません"
          description="URL の問題 ID が正しいか確認してください。問題一覧から選び直せます。"
          action={
            <LinkButton href="/problems" variant="secondary">
              問題一覧へ戻る
            </LinkButton>
          }
        />
      </PageContainer>
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
      languages={p.meta.languages.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
      kind={p.tests.kind}
      hasFollowups={p.meta.followups.length > 0}
      defaultMode={p.meta.interviewer_mode}
    />
  );
}
