import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { Kbd, PageHeader } from "@/components/ui";
import { loadBrowseData } from "./browse-data.ts";
import { buildRecords, formatDay, parseFilters } from "./browse-model.ts";
import { ProblemBrowser, type RecordView } from "./ProblemBrowser.tsx";

export const dynamic = "force-dynamic";

/**
 * S1 問題一覧（02 §2.2 / §3.2）。問題文はここでは見せない（04 §6.1: 初見で要件を読む練習にならない）。
 * フィルタは URL に保持して再現できるようにする（FR-U-02）。自分の記録（挑戦回数・最新の総合）を列に出す。
 */
export default async function ProblemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initial = parseFilters((k) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  });
  const { problems, sessions } = await loadBrowseData();
  // 日付の整形はサーバで済ませる（クライアントとタイムゾーンがずれても表示が揺れないように）
  const records: Record<string, RecordView> = {};
  for (const [id, r] of buildRecords(sessions)) {
    records[id] = { ...r, lastDay: formatDay(r.lastAt) };
  }
  return (
    <PageContainer as="main">
      <PageHeader
        title="問題を選ぶ"
        description="絞り込んで、比べて、1 本選ぶ。問題文は開始前の画面で確かめられます。"
        meta={
          <span className="hidden items-center gap-1.5 desktop:inline-flex">
            <Kbd>/</Kbd> 検索 <span aria-hidden="true">·</span> <Kbd>j</Kbd>
            <Kbd>k</Kbd> 移動 <span aria-hidden="true">·</span> <Kbd>Enter</Kbd> 開く
          </span>
        }
      />
      <ProblemBrowser problems={problems} records={records} initial={initial} />
    </PageContainer>
  );
}
