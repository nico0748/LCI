import { notFound } from "next/navigation";
import { CATEGORY_LABEL, LANGUAGE_LABEL } from "@lci/core";
import { problem } from "@/lib/server";
import { PageContainer } from "@/components/layout/PageContainer.tsx";
import { Breadcrumbs, Disclosure, Dl, LinkButton, NotificationBanner, StatusBadge, cx } from "@/components/ui";
import { Markdown } from "@/components/review/markdown";
import { loadBrowseData } from "../browse-data.ts";
import { AXIS_LABEL, JUDGE_LABEL, buildRecords, formatDay, styleLabel } from "../browse-model.ts";
import { Dot, OverallText } from "../browse-ui.tsx";
import { StartForm } from "./StartForm.tsx";

export const dynamic = "force-dynamic";

/**
 * S2 ブリーフィング（02 §2.3 / §3.3）=「開始前の不安を減らす」。
 * この練習の流れ → 条件（1 か所にまとめる）→ 問題文（X10: 既定は閉じる）。右に開始パネルと前回の記録。
 * talking_points / requirements / rubric_hints / 面接官メモ / 解説はここでは出さない。
 * レビュー画面で初めて開示する（04 §6.4, FR-U-15）。
 */
export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await problem(id);
  if (!p) notFound();
  const { meta, body } = p;
  const { sessions } = await loadBrowseData();
  const rec = buildRecords(sessions).get(meta.id);
  const starters = meta.starter_files.map((f) => f.path);
  const banner = meta.tier !== "core";
  const styles = meta.tags.company_style.map(styleLabel).filter((s): s is string => s != null);

  return (
    <PageContainer as="main" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Breadcrumbs
          items={[
            { label: "ホーム", href: "/" },
            { label: "問題一覧", href: "/problems" },
            { label: meta.id, mono: true },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-dns-13N-130 text-fg-muted">
          <span>
            <span className="text-mono-12N-120 text-fg-body">{meta.category}</span> {CATEGORY_LABEL[meta.category]}
          </span>
          <Dot />
          <span className="text-mono-12N-120">{meta.difficulty}</span>
          <Dot />
          <span className="tabular-nums">{meta.time_limit} 分</span>
          {styles.map((s) => (
            <span key={s} className="contents">
              <Dot />
              <span>{s} 形式</span>
            </span>
          ))}
          {meta.tier !== "core" && (
            <StatusBadge variant="outlined" tone={meta.tier === "draft" ? "warning" : "neutral"} glyph={false} className="ml-1">
              {meta.tier === "draft" ? "下書き" : "自動生成"}
            </StatusBadge>
          )}
        </div>
        <h1 className="text-std-24B-150 text-fg">{meta.title}</h1>
        {meta.tags.nfr.length > 0 && <p className="text-dns-13N-130 text-fg-muted">扱うテーマ: {meta.tags.nfr.join("・")}</p>}
      </header>

      {/* モバイルは 1 列で「流れ → 開始 → 条件 → 問題文」。desktop では開始パネルを右列に固定する */}
      <div
        className={cx(
          "grid gap-6 desktop:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-8",
          // 右列の開始パネルが縦に長くても、左列の節の間が空かないよう最後の行で吸収する
          banner ? "desktop:grid-rows-[auto_auto_auto_1fr]" : "desktop:grid-rows-[auto_auto_1fr]",
        )}
      >
        {banner && (
          <NotificationBanner tone="info" live="off" className="desktop:col-start-1">
            {meta.tier === "draft" ? "この問題は下書きです。" : "この問題は自動生成されたもので、"}人手のレビュー前です。問題文や判定に誤りがあるかもしれません。
          </NotificationBanner>
        )}

        <section aria-labelledby="flow-heading" className="flex min-w-0 flex-col gap-3 desktop:col-start-1">
          <h2 id="flow-heading" className="text-std-20B-150 text-fg">
            この練習の流れ
          </h2>
          <ol className="flex flex-col gap-3 rounded-8 border border-border bg-surface p-4">
            {[
              <>「開始する」を押すと事前確認に進みます。カメラ・マイクと面接官のモード（無言 / 追問あり）をそこで確かめます。</>,
              <>
                面接が始まると、録画と編集ログの記録、<strong className="font-bold text-fg">{meta.time_limit} 分</strong>のタイマーが動きます。残り 5 分で時計の色が変わります。
              </>,
              <>「終了」を押すか、時間切れで終わります。話しながら書いてください。</>,
              <>終了後のレビューで、面接官メモ・隠しテスト・解説が開きます。</>,
            ].map((text, i) => (
              <li key={i} className="grid grid-cols-[1.75rem_1fr] items-start gap-x-2">
                <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full border border-border-strong text-mono-12N-120 text-fg-body">
                  {i + 1}
                </span>
                <span className="text-std-14N-170 text-fg-body">{text}</span>
              </li>
            ))}
          </ol>
          <p className="text-dns-13N-130 text-fg-muted">記録はこの Mac の中だけに保存されます。</p>
        </section>

        <aside aria-label="開始" className={cx(
            "flex flex-col gap-4 desktop:sticky desktop:top-6 desktop:col-start-2 desktop:row-start-1 desktop:self-start",
            banner ? "desktop:row-span-4" : "desktop:row-span-3",
          )}>
          <div className="flex flex-col gap-4 rounded-8 border border-border bg-surface p-4">
            <StartForm problemId={meta.id} languages={meta.languages} timeLimit={meta.time_limit} />
            <p className="border-t border-border-subtle pt-3 text-dns-13N-130 text-fg-muted min-[80rem]:hidden">
              面接画面は幅 1280px 以上で使えます。PC の画面で開いてください。
            </p>
          </div>
          <PreviousRecord rec={rec} />
        </aside>

        <section aria-labelledby="cond-heading" className="flex min-w-0 flex-col gap-3 desktop:col-start-1">
          <h2 id="cond-heading" className="text-std-20B-150 text-fg">
            条件
          </h2>
          <div className="rounded-8 border border-border bg-surface p-4">
            <Dl
              className="gap-y-2.5"
              items={[
                { term: "制限時間", description: `${meta.time_limit} 分`, numeric: true },
                { term: "面接官", description: meta.interviewer_mode === "silent" ? "無言モード（既定）" : "追問あり（既定）" },
                { term: "質問", description: meta.allow_questions ? "できる（質問ログに残す）" : "できない" },
                { term: "Web 検索", description: meta.web_search ? "使ってよい" : "使えない" },
                { term: "動作確認", description: JUDGE_LABEL[p.tests.kind] },
                { term: "対応言語", description: meta.languages.map((l) => LANGUAGE_LABEL[l]).join("、") },
                ...(starters.length > 0 ? [{ term: "最初のファイル", description: <span className="text-mono-13N-150">{starters.join(", ")}</span> }] : []),
              ]}
            />
          </div>
        </section>

        <section aria-labelledby="statement-heading" className="flex min-w-0 flex-col gap-3 desktop:col-start-1">
          <h2 id="statement-heading" className="text-std-20B-150 text-fg">
            問題文
          </h2>
          <p className="text-std-14N-170 text-fg-muted">本番では、問題が出てから時計が動きます。初見で要件を確かめる練習にするなら、開かずに開始してください。</p>
          <div className="rounded-8 border border-border bg-surface px-4 py-2">
            <Disclosure summary="開始前に読む" meta={<span className="hidden desktop:inline">初見での要件確認の練習にはなりません</span>}>
              <div className="flex flex-col gap-4 pb-2">
                <NotificationBanner tone="info" variant="compact" live="off">
                  開始前に問題文を読みました。要件確認（R1）の練習としては、本番より有利な条件です。
                </NotificationBanner>
                <div className="max-w-[72ch] text-std-14N-170 text-fg-body">
                  <Markdown text={body.statement} />
                </div>
                {body.constraints && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-dns-16B-130 text-fg">制約</h3>
                    <div className="max-w-[72ch] text-std-14N-170 text-fg-body">
                      <Markdown text={body.constraints} />
                    </div>
                  </div>
                )}
              </div>
            </Disclosure>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/** この問題の前回の記録（再挑戦の不安を「何に気を付ければいいか」に変える） */
function PreviousRecord({ rec }: { rec: ReturnType<ReturnType<typeof buildRecords>["get"]> }) {
  if (!rec) {
    return <p className="px-1 text-dns-13N-130 text-fg-muted">この問題は初めての挑戦です。</p>;
  }
  const next = rec.nextPractice[0];
  return (
    <section aria-labelledby="prev-heading" className="flex flex-col gap-2 rounded-8 border border-border bg-surface p-4">
      <h2 id="prev-heading" className="text-dns-14B-130 text-fg">
        前回の記録
      </h2>
      <p className="text-dns-13N-130 text-fg-muted">
        <span className="text-mono-12N-120">{formatDay(rec.lastAt)}</span> <Dot /> {rec.attempts} 回挑戦 <Dot /> <OverallText value={rec.lastOverall} />
      </p>
      {next && (
        <p className="text-std-14N-170 text-fg-body">
          <span className="text-dns-13N-130 text-fg-muted">前回の課題（{AXIS_LABEL[next.axis]}）</span>
          <br />
          {next.action}
        </p>
      )}
      <LinkButton href={`/sessions/${rec.lastEvaluatedSessionId ?? rec.lastSessionId}`} variant="tertiary" size="xs" className="self-start">
        前回のレビューを開く
      </LinkButton>
    </section>
  );
}
