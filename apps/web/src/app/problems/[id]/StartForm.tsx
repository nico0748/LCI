"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_LABEL, type Language } from "@lci/core/browser";

/**
 * 言語を選んで開始。Enter 1 回で S3 へ（04 §5.2）。
 * セッション作成ページ `/session/new` は W1 が実装する。
 */
export function StartForm({ problemId, languages, timeLimit }: { problemId: string; languages: Language[]; timeLimit: number }) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(languages[0]!);
  const href = `/session/new?problem=${encodeURIComponent(problemId)}&lang=${encodeURIComponent(lang)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "Enter" && !(el && (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "A" || el.tagName === "BUTTON"))) {
        e.preventDefault();
        router.push(href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);

  return (
    <form
      className="rounded-lg border border-border bg-bg-elev p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      <label className="block text-sm">
        <span className="text-fg-muted">言語</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm">
          {languages.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABEL[l]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="w-full rounded-md bg-accent text-accent-fg py-2 text-sm font-medium hover:opacity-90">
        開始する（{timeLimit} 分）
      </button>
      <p className="text-[11px] text-fg-muted text-center">
        <kbd className="font-mono border border-border rounded px-1">Enter</kbd> でも開始
      </p>
    </form>
  );
}
