"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL, LANGUAGE_LABEL, type Language, type ProblemSummary } from "@lci/core/browser";
import {
  Button,
  Checkbox,
  ChoiceGroup,
  EmptyState,
  Field,
  SearchBox,
  Select,
  StatusBadge,
  TBody,
  THead,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
  cx,
  tableRowLinkClass,
} from "@/components/ui";
import {
  CATEGORY_ORDER,
  DIFFICULTIES,
  EMPTY_FILTERS,
  PROBLEM_STATE_LABEL,
  RETRY_THRESHOLD,
  TIME_LIMITS,
  filterProblems,
  filtersToEntries,
  hasActiveFilters,
  problemState,
  type BrowserFilters,
  type MultiKey,
  type ProblemRecord,
  type ProblemState,
} from "./browse-model.ts";
import { Dot, ProblemFacts, rowLinkClass } from "./browse-ui.tsx";

export type { BrowserFilters } from "./browse-model.ts";

/** サーバで日付を整形済みの記録 */
export type RecordView = ProblemRecord & { lastDay: string };

const STATES: ProblemState[] = ["untried", "tried", "retry"];

/** j/k を受け付けない（文字入力中の）要素か */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "reset"].includes(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);

/**
 * 一覧（クライアント側で絞り込み・検索・キーボード移動）。問題数は数百件程度なので全件を受け取って絞り込む。
 * 構造: 768px 以上は列見出し付きの <table>、未満は 2〜3 行の <ul>（タイトルは切らない、02 §3.2）。
 * キーボード: / で検索、j/k で行のリンクに実フォーカスを移す（roving tabindex。listbox は使わない）、
 * Enter はフォーカス中のリンクを開く。検索欄で Enter を押すとカーソル行を開く。矢印キーは奪わない。
 */
export function ProblemBrowser({ problems, records, initial }: { problems: ProblemSummary[]; records: Record<string, RecordView>; initial: BrowserFilters }) {
  const router = useRouter();
  const [f, setF] = useState<BrowserFilters>(initial);
  const [cursor, setCursor] = useState(0);
  // キーボードで動かし始めるまでカーソル行を塗らない（読み込み直後に 1 行目だけ選ばれて見えるのを避ける）
  const [showCursor, setShowCursor] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recordMap = useMemo(() => new Map(Object.entries(records)), [records]);

  // URL に反映（履歴は汚さない）
  useEffect(() => {
    const u = new URL(window.location.href);
    for (const k of ["q", "category", "difficulty", "time_limit", "status", "language", "nfr", "drafts", "tier"]) u.searchParams.delete(k);
    for (const [k, v] of filtersToEntries(f)) u.searchParams.set(k, v);
    window.history.replaceState(window.history.state, "", u.toString());
  }, [f]);

  const visible = useMemo(() => problems.filter((p) => f.drafts || p.tier !== "draft"), [problems, f.drafts]);
  const draftCount = useMemo(() => problems.filter((p) => p.tier === "draft").length, [problems]);
  const nfrTags = useMemo(() => [...new Set(visible.flatMap((p) => p.tags.nfr))].sort(), [visible]);
  const languages = useMemo(() => [...new Set(visible.flatMap((p) => p.languages))] as Language[], [visible]);
  const filtered = useMemo(() => filterProblems(problems, recordMap, f), [problems, recordMap, f]);

  /** チェックボックスの横の件数: その項目以外の条件を当てたときの件数 */
  const facet = useCallback(
    (key: MultiKey, value: (p: ProblemSummary) => string) => {
      const counts = new Map<string, number>();
      for (const p of filterProblems(problems, recordMap, f, key)) counts.set(value(p), (counts.get(value(p)) ?? 0) + 1);
      return counts;
    },
    [problems, recordMap, f],
  );
  const catCounts = useMemo(() => facet("category", (p) => p.category), [facet]);
  const diffCounts = useMemo(() => facet("difficulty", (p) => p.difficulty), [facet]);
  const timeCounts = useMemo(() => facet("time_limit", (p) => String(p.time_limit)), [facet]);
  const stateCounts = useMemo(() => facet("status", (p) => problemState(recordMap.get(p.id))), [facet, recordMap]);
  const categories = CATEGORY_ORDER.filter((c) => visible.some((p) => p.category === c));
  const times = TIME_LIMITS.filter((t) => visible.some((p) => p.time_limit === t));
  const difficulties = DIFFICULTIES.filter((d) => visible.some((p) => p.difficulty === d));

  // 絞り込みで件数が減ったら、カーソルを末尾に寄せる（state は直さず、表示と操作で使う値だけ丸める）
  const cur = Math.min(cursor, Math.max(0, filtered.length - 1));

  /** いま見えている方（表かリスト）の行リンク */
  const rowLink = useCallback((i: number): HTMLAnchorElement | null => {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>(`a[data-row="${i}"]`) ?? [];
    return [...links].find((a) => a.offsetParent !== null) ?? null;
  }, []);

  const open = useCallback((i: number) => {
    const p = filtered[i];
    if (p) router.push(`/problems/${p.id}`);
  }, [filtered, router]);

  // キーボード: / 検索、j/k 移動（FR-U-02）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = document.activeElement;
      if (isTypingTarget(el)) return;
      if (el?.closest("dialog")) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key !== "j" && e.key !== "k" && e.key !== "Enter") return;
      if (filtered.length === 0) return;
      const onRow = el instanceof HTMLAnchorElement && el.dataset.row !== undefined;
      if (e.key === "Enter") {
        // フォーカスが操作要素に無いときだけ、カーソル行を開く（操作要素の Enter はその要素のもの）
        if (!el || !INTERACTIVE.has(el.tagName)) {
          e.preventDefault();
          open(cur);
        }
        return;
      }
      e.preventDefault();
      const next = !onRow ? cur : e.key === "j" ? Math.min(filtered.length - 1, cur + 1) : Math.max(0, cur - 1);
      setCursor(next);
      setShowCursor(true);
      rowLink(next)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length, cur, open, rowLink]);

  const toggle = (k: MultiKey, v: string) => (checked: boolean) =>
    setF((s) => ({ ...s, [k]: checked ? [...s[k], v] : s[k].filter((x) => x !== v) }));
  const clearAll = () => setF(EMPTY_FILTERS);

  // 適用中の条件（一覧の直上に要約し、1 つずつ外せるようにする）
  const applied: { label: string; remove: () => void }[] = [
    ...f.status.map((v) => ({ label: PROBLEM_STATE_LABEL[v as ProblemState] ?? v, remove: () => toggle("status", v)(false) })),
    ...f.category.map((v) => ({ label: v, remove: () => toggle("category", v)(false) })),
    ...f.difficulty.map((v) => ({ label: v, remove: () => toggle("difficulty", v)(false) })),
    ...f.time_limit.map((v) => ({ label: `${v} 分`, remove: () => toggle("time_limit", v)(false) })),
    ...(f.language ? [{ label: LANGUAGE_LABEL[f.language as Language] ?? f.language, remove: () => setF((s) => ({ ...s, language: "" })) }] : []),
    ...(f.nfr ? [{ label: f.nfr, remove: () => setF((s) => ({ ...s, nfr: "" })) }] : []),
    ...(f.drafts ? [{ label: "下書きを含む", remove: () => setF((s) => ({ ...s, drafts: false })) }] : []),
    ...(f.q ? [{ label: `「${f.q}」`, remove: () => setF((s) => ({ ...s, q: "" })) }] : []),
  ];
  const filterCount = applied.length - (f.q ? 1 : 0);

  const rowProps = (i: number) => ({
    "data-row": i,
    tabIndex: i === cur ? 0 : -1,
    "aria-current": showCursor && i === cur ? ("true" as const) : undefined,
    onFocus: () => {
      setCursor(i);
      setShowCursor(true);
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start">
      {/* 絞り込み。1024px 未満では「絞り込み」ボタンで開閉する */}
      <div className="flex flex-col gap-3">
        <SearchBox
          ref={searchRef}
          value={f.q}
          onValueChange={(q) => setF((s) => ({ ...s, q }))}
          label="キーワード"
          shortcutHint="/"
          placeholder="例: cache、fe-0003"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              open(cur);
            } else if (e.key === "Escape" && !f.q) {
              e.currentTarget.blur();
            } else if (e.key === "ArrowDown" && filtered.length) {
              e.preventDefault();
              setShowCursor(true);
              rowLink(cur)?.focus();
            }
          }}
        />
        <Button
          className="self-start lg:hidden"
          aria-expanded={filtersOpen}
          aria-controls="problem-filters"
          onClick={() => setFiltersOpen((v) => !v)}
          icon={
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
              <path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          }
        >
          絞り込み{filterCount > 0 && <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-selected px-1.5 text-mono-12N-120 text-fg">{filterCount}<span className="sr-only"> 件の条件</span></span>}
        </Button>
        <div
          id="problem-filters"
          className={cx(
            filtersOpen ? "flex" : "hidden",
            "flex-col gap-5 rounded-8 border border-border bg-surface p-4 lg:flex lg:border-0 lg:bg-transparent lg:p-0",
          )}
        >
          <ChoiceGroup legend="自分の記録" hint={`要再挑戦 = 最新の総合が ${RETRY_THRESHOLD} 未満`}>
            {STATES.map((s) => (
              <Checkbox key={s} checked={f.status.includes(s)} onChange={(e) => toggle("status", s)(e.target.checked)}>
                {PROBLEM_STATE_LABEL[s]} <Count n={stateCounts.get(s) ?? 0} />
              </Checkbox>
            ))}
          </ChoiceGroup>
          <ChoiceGroup legend="カテゴリ">
            {categories.map((c) => (
              <Checkbox key={c} checked={f.category.includes(c)} onChange={(e) => toggle("category", c)(e.target.checked)}>
                <span className="text-mono-13N-150 text-fg-muted">{c}</span> {CATEGORY_LABEL[c]} <Count n={catCounts.get(c) ?? 0} />
              </Checkbox>
            ))}
          </ChoiceGroup>
          <ChoiceGroup legend="難易度" orientation="horizontal">
            {difficulties.map((d) => (
              <Checkbox key={d} checked={f.difficulty.includes(d)} onChange={(e) => toggle("difficulty", d)(e.target.checked)}>
                <span className="text-mono-13N-150">{d}</span> <Count n={diffCounts.get(d) ?? 0} />
              </Checkbox>
            ))}
          </ChoiceGroup>
          <ChoiceGroup legend="制限時間" orientation="horizontal">
            {times.map((t) => (
              <Checkbox key={t} checked={f.time_limit.includes(String(t))} onChange={(e) => toggle("time_limit", String(t))(e.target.checked)}>
                {t} 分 <Count n={timeCounts.get(String(t)) ?? 0} />
              </Checkbox>
            ))}
          </ChoiceGroup>
          <Field label="言語">
            {(p) => (
              <Select {...p} value={f.language} onChange={(e) => setF((s) => ({ ...s, language: e.target.value }))}>
                <option value="">すべて</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABEL[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="扱うテーマ">
            {(p) => (
              <Select {...p} value={f.nfr} onChange={(e) => setF((s) => ({ ...s, nfr: e.target.value }))}>
                <option value="">すべて</option>
                {nfrTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {draftCount > 0 && (
            <Checkbox checked={f.drafts} onChange={(e) => setF((s) => ({ ...s, drafts: e.target.checked }))} hint="人手のレビュー前の問題">
              下書きも表示 <Count n={draftCount} />
            </Checkbox>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
          <p aria-live="polite" className="text-dns-14N-130 text-fg-body">
            <span className="text-dns-14B-130 tabular-nums text-fg">{filtered.length}</span> 問
            <span className="text-fg-muted"> / 全 {visible.length} 問</span>
          </p>
          {applied.length > 0 && (
            <>
              <ul aria-label="適用中の条件" className="flex flex-wrap items-center gap-1.5">
                {applied.map((a) => (
                  <li key={a.label}>
                    <RemoveChip label={a.label} onRemove={a.remove} />
                  </li>
                ))}
              </ul>
              <Button variant="tertiary" size="xs" onClick={clearAll}>
                すべて解除
              </Button>
            </>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="条件に合う問題がありません"
            description={hasActiveFilters(f) ? "条件を 1 つずつ外すか、まとめて解除してください。" : "問題バンクに問題がありません。problems/ を確かめてください。"}
            action={
              hasActiveFilters(f) && (
                <Button onClick={clearAll} size="sm">
                  条件をすべて解除
                </Button>
              )
            }
          />
        ) : (
          <div ref={listRef}>
            {/* 768px 以上: 列見出し付きの表（行全体が 1 つのリンク） */}
            <TableScroll className="hidden desktop:block">
              <Table caption="問題一覧" captionHidden>
                <THead>
                  <tr>
                    <Th>問題</Th>
                    <Th>分類</Th>
                    <Th>難易度</Th>
                    <Th numeric>時間</Th>
                    <Th className="hidden xl:table-cell">言語</Th>
                    <Th>自分の記録</Th>
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((p, i) => {
                    const rec = records[p.id];
                    const langs = p.languages.map((l) => LANGUAGE_LABEL[l]).join(", ");
                    return (
                      <Tr key={p.id} interactive selected={showCursor && i === cur}>
                        <Td className="min-w-[16rem] py-2.5">
                          <Link href={`/problems/${p.id}`} className={cx(tableRowLinkClass, "text-dns-14B-130")} {...rowProps(i)}>
                            {p.title}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-dns-13N-130 text-fg-muted">
                            <span className="text-mono-12N-120">{p.id}</span>
                            {p.tags.nfr.length > 0 && (
                              <>
                                <Dot />
                                <span>{p.tags.nfr.join("・")}</span>
                              </>
                            )}
                            <span className="xl:hidden">
                              <Dot /> {langs}
                            </span>
                            <TierBadge tier={p.tier} />
                          </div>
                        </Td>
                        <Td>
                          <span className="text-mono-13N-150" title={CATEGORY_LABEL[p.category]}>
                            {p.category}
                          </span>
                          <span className="sr-only"> {CATEGORY_LABEL[p.category]}</span>
                        </Td>
                        <Td mono>{p.difficulty}</Td>
                        <Td numeric>{p.time_limit} 分</Td>
                        <Td className="hidden max-w-40 text-dns-13N-130 text-fg-muted xl:table-cell">{langs}</Td>
                        <Td className="whitespace-nowrap">
                          <RecordCell rec={rec} />
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>

            {/* 768px 未満: タイトルを全文で出す 2〜3 行のリスト */}
            <ul aria-label="問題一覧" className="rounded-8 border border-border bg-surface desktop:hidden">
              {filtered.map((p, i) => (
                <li
                  key={p.id}
                  data-selected={(showCursor && i === cur) || undefined}
                  className="relative flex flex-col gap-1.5 border-b border-border-subtle px-4 py-3 last:border-b-0 can-hover:bg-hover data-[selected]:bg-selected"
                >
                  <Link href={`/problems/${p.id}`} className={cx(rowLinkClass, "text-dns-16B-130")} {...rowProps(i)}>
                    {p.title}
                  </Link>
                  <ProblemFacts p={p} short languages={p.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")} />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <RecordCell rec={records[p.id]} inline />
                    <TierBadge tier={p.tier} />
                    <span className="ml-auto text-mono-12N-120 text-fg-muted">{p.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-0.5 tabular-nums text-fg-muted">{n}</span>;
}

function TierBadge({ tier }: { tier: ProblemSummary["tier"] }) {
  if (tier === "core") return null;
  return (
    <StatusBadge variant="outlined" tone={tier === "draft" ? "warning" : "neutral"} glyph={false}>
      {tier === "draft" ? "下書き" : "自動生成"}
    </StatusBadge>
  );
}

/** 自分の記録: 最新の総合と最終日、要再挑戦はテキスト付きのチップ */
function RecordCell({ rec, inline }: { rec: RecordView | undefined; inline?: boolean }) {
  if (!rec) return <span className="text-dns-13N-130 text-fg-muted">未着手</span>;
  return (
    <span className={cx("inline-flex gap-x-1.5 gap-y-0.5", inline ? "flex-row flex-wrap items-center" : "flex-col items-start")}>
      <span className="inline-flex items-center gap-1.5">
        {rec.lastOverall != null ? (
          <span className="text-dns-13N-130 text-fg-muted">
            総合 <span className="text-mono-13N-150 text-fg-body">{rec.lastOverall.toFixed(1)}</span>
          </span>
        ) : (
          <span className="text-dns-13N-130 text-fg-muted">未評価</span>
        )}
        {rec.state === "retry" && (
          <StatusBadge variant="outlined" glyph={false}>
            要再挑戦
          </StatusBadge>
        )}
      </span>
      <span className="text-dns-13N-130 text-fg-muted">
        <span className="text-mono-12N-120">{rec.lastDay}</span> · {rec.attempts} 回
      </span>
    </span>
  );
}

/**
 * 適用中の条件のチップ（押すとその条件を外す）。DADS ChipLabel は押せないので、× 付きのボタンとして自作する。
 * FilterChip（aria-pressed のトグル）と違い、押すと消える一方向の操作。
 */
function RemoveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      data-ui="button"
      onClick={onRemove}
      aria-label={`${label} の条件を外す`}
      className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border-input bg-surface pl-2.5 pr-2 text-dns-13N-130 text-fg-body can-hover:bg-hover"
    >
      <span>{label}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" className="text-fg-muted">
        <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  );
}
