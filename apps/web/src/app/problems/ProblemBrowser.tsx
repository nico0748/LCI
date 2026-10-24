"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL, LANGUAGE_LABEL, type Category, type Language, type ProblemSummary } from "@lci/core/browser";

export interface BrowserFilters {
  q: string;
  category: string;
  difficulty: string;
  time_limit: string;
  language: string;
  tier: string;
  nfr: string;
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as Category[];
const TIER_LABEL: Record<string, string> = { core: "core", generated: "自動生成", draft: "下書き" };

/**
 * クライアント側でフィルタ・検索・キーボード移動を行う一覧。
 * 問題数は数百件程度なので全件を受け取って絞り込む方が速く、URL も即時に同期できる。
 */
export function ProblemBrowser({ problems, initial }: { problems: ProblemSummary[]; initial: BrowserFilters }) {
  const router = useRouter();
  const [f, setF] = useState<BrowserFilters>(initial);
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // URL に反映（履歴は汚さない）
  useEffect(() => {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(f)) {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    }
    window.history.replaceState(window.history.state, "", u.toString());
  }, [f]);

  const nfrTags = useMemo(() => [...new Set(problems.flatMap((p) => p.tags.nfr))].sort(), [problems]);
  const languages = useMemo(() => [...new Set(problems.flatMap((p) => p.languages))] as Language[], [problems]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return problems
      .filter((p) => !f.category || p.category === f.category)
      .filter((p) => !f.difficulty || p.difficulty === f.difficulty)
      .filter((p) => !f.time_limit || String(p.time_limit) === f.time_limit)
      .filter((p) => !f.language || p.languages.includes(f.language as Language))
      .filter((p) => !f.tier || p.tier === f.tier)
      .filter((p) => !f.nfr || p.tags.nfr.includes(f.nfr))
      .filter((p) => {
        if (!q) return true;
        const hay = [p.id, p.slug, p.title, ...p.tags.nfr, ...p.tags.company_style, ...p.tags.talk_focus, ...p.tags.security].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.difficulty.localeCompare(b.difficulty) || a.id.localeCompare(b.id));
  }, [problems, f]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // キーボード: / 検索、j/k 移動、Enter で開く（FR-U-02）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) {
        if (e.key === "Escape") (el as HTMLElement).blur();
        if (e.key === "Enter" && el.tagName === "INPUT" && filtered[cursor]) router.push(`/problems/${filtered[cursor].id}`);
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && filtered[cursor]) {
        router.push(`/problems/${filtered[cursor].id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, cursor, router]);

  useEffect(() => {
    const li = listRef.current?.children[cursor] as HTMLElement | undefined;
    li?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const set = (k: keyof BrowserFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const selectCls = "rounded-md border border-border bg-bg-elev px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="search">
        <input
          ref={searchRef}
          type="search"
          value={f.q}
          onChange={set("q")}
          placeholder="検索（ID・タイトル・タグ）"
          aria-label="問題を検索"
          className={`${selectCls} min-w-56 flex-1`}
        />
        <select value={f.category} onChange={set("category")} aria-label="カテゴリ" className={selectCls}>
          <option value="">カテゴリ: すべて</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {c} {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select value={f.difficulty} onChange={set("difficulty")} aria-label="難易度" className={selectCls}>
          <option value="">難易度: すべて</option>
          {["L1", "L2", "L3", "L4"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={f.time_limit} onChange={set("time_limit")} aria-label="制限時間" className={selectCls}>
          <option value="">時間: すべて</option>
          {[15, 20, 30, 45].map((t) => (
            <option key={t} value={String(t)}>
              {t} 分
            </option>
          ))}
        </select>
        <select value={f.language} onChange={set("language")} aria-label="言語" className={selectCls}>
          <option value="">言語: すべて</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABEL[l]}
            </option>
          ))}
        </select>
        <select value={f.tier} onChange={set("tier")} aria-label="tier" className={selectCls}>
          <option value="">tier: すべて</option>
          <option value="core">core（人手レビュー済）</option>
          <option value="generated">自動生成</option>
          <option value="draft">下書き</option>
        </select>
        <select value={f.nfr} onChange={set("nfr")} aria-label="非機能タグ" className={selectCls}>
          <option value="">NFR: すべて</option>
          {nfrTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {Object.values(f).some(Boolean) && (
          <button type="button" onClick={() => setF({ q: "", category: "", difficulty: "", time_limit: "", language: "", tier: "", nfr: "" })} className="text-sm text-fg-muted hover:text-fg underline-offset-2 hover:underline">
            クリア
          </button>
        )}
      </div>

      <p className="text-xs text-fg-muted">{filtered.length} 問 / 全 {problems.length} 問</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-fg-muted rounded-lg border border-border bg-bg-elev p-6 text-center">条件に合う問題がありません。</p>
      ) : (
        <ul ref={listRef} className="divide-y divide-border rounded-lg border border-border bg-bg-elev" role="listbox" aria-label="問題一覧">
          {filtered.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === cursor}>
              <Link
                href={`/problems/${p.id}`}
                onMouseEnter={() => setCursor(i)}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-bg ${i === cursor ? "bg-bg outline outline-1 -outline-offset-1 outline-accent/60" : ""}`}
              >
                <span className="font-mono text-xs text-fg-muted w-16 shrink-0">{p.id}</span>
                <span className="rounded px-1.5 py-0.5 text-[11px] font-mono border border-border text-fg-muted shrink-0" title={CATEGORY_LABEL[p.category]}>
                  {p.category}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium">{p.title}</span>
                {p.tier !== "core" && <span className={`rounded px-1.5 py-0.5 text-[11px] border ${p.tier === "draft" ? "border-warn/50 text-warn" : "border-border text-fg-muted"}`}>{TIER_LABEL[p.tier]}</span>}
                {p.tags.nfr.length > 0 && <span className="hidden md:inline text-[11px] text-fg-muted truncate max-w-40">{p.tags.nfr.join(" · ")}</span>}
                <span className="font-mono text-xs text-fg-muted shrink-0">{p.difficulty}</span>
                <span className="font-mono text-xs text-fg-muted shrink-0 w-10 text-right">{p.time_limit} 分</span>
                <span className="text-xs text-fg-muted shrink-0 w-28 text-right truncate">{p.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
