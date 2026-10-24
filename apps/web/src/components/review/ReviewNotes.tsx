"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABEL, type Language, type Problem } from "@lci/core/browser";
import { Markdown } from "./markdown";

type Revealed = Problem & { reference_solution_texts?: Record<string, string> };

/**
 * 振り返り用解説・面接官メモ・参照解・隠しテスト。レビュー画面でだけ `?reveal=1` で取得する（FR-U-15）。
 * 既定で畳んでおき、開く操作を 1 回挟む（自分の振り返りを先に済ませるため）。
 */
export function ReviewNotes({ problemId, language }: { problemId: string; language: Language }) {
  const [p, setP] = useState<Revealed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || p) return;
    let cancelled = false;
    fetch(`/api/problems/${encodeURIComponent(problemId)}?reveal=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Revealed;
      })
      .then((d) => {
        if (!cancelled) setP(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, p, problemId]);

  const solutions = p?.reference_solution_texts ?? {};
  const solLangs = Object.keys(solutions) as Language[];
  const primary = solLangs.includes(language) ? language : solLangs[0];

  return (
    <section className="rounded-lg border border-border bg-bg-elev">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left" aria-expanded={open}>
        <span className="text-sm font-semibold">振り返り用解説・参照解</span>
        <span className="text-xs text-fg-muted">{open ? "閉じる" : "開く（終了後のみ開示）"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-5 text-sm">
          {err && <p className="text-danger text-xs">読み込みに失敗しました: {err}</p>}
          {!p && !err && <p className="text-xs text-fg-muted">読み込み中…</p>}
          {p && (
            <>
              {p.body.review_notes ? (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-fg-muted">振り返り用解説</h3>
                  <Markdown text={p.body.review_notes} />
                </div>
              ) : (
                <p className="text-xs text-fg-muted">この問題には解説がありません。</p>
              )}
              {p.body.interviewer_notes && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-fg-muted">面接官メモ（面接官が見ていた観点）</summary>
                  <div className="mt-2">
                    <Markdown text={p.body.interviewer_notes} />
                  </div>
                </details>
              )}
              {(p.meta.rubric_hints.red_flags.length > 0 || p.meta.rubric_hints.checklist.length > 0) && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-fg-muted">採点ヒント</summary>
                  <div className="mt-2 space-y-2 text-xs">
                    {p.meta.rubric_hints.correctness && <p><span className="text-fg-muted">正確性: </span>{p.meta.rubric_hints.correctness}</p>}
                    {p.meta.rubric_hints.explanation && <p><span className="text-fg-muted">説明: </span>{p.meta.rubric_hints.explanation}</p>}
                    {p.meta.rubric_hints.time_management && <p><span className="text-fg-muted">時間: </span>{p.meta.rubric_hints.time_management}</p>}
                    {p.meta.rubric_hints.red_flags.length > 0 && (
                      <div>
                        <div className="text-fg-muted">レッドフラグ</div>
                        <ul className="list-disc pl-4">
                          {p.meta.rubric_hints.red_flags.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              )}
              {primary && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-fg-muted">参照解（{LANGUAGE_LABEL[primary]}）</h3>
                    {solLangs.length > 1 && <span className="text-[11px] text-fg-muted">他: {solLangs.filter((l) => l !== primary).map((l) => LANGUAGE_LABEL[l]).join(", ")}</span>}
                  </div>
                  <pre className="font-mono text-[12px] leading-relaxed rounded-md border border-border bg-bg p-3 overflow-auto max-h-[60vh] whitespace-pre">
                    <code>{solutions[primary]}</code>
                  </pre>
                  {solLangs
                    .filter((l) => l !== primary)
                    .map((l) => (
                      <details key={l}>
                        <summary className="cursor-pointer text-xs text-fg-muted">{LANGUAGE_LABEL[l]} の参照解</summary>
                        <pre className="mt-1 font-mono text-[12px] leading-relaxed rounded-md border border-border bg-bg p-3 overflow-auto max-h-[60vh] whitespace-pre">
                          <code>{solutions[l]}</code>
                        </pre>
                      </details>
                    ))}
                </div>
              )}
              <HiddenTests tests={p.tests} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function HiddenTests({ tests }: { tests: Problem["tests"] }) {
  if (tests.kind === "stdio") {
    const hidden = tests.cases.filter((c) => c.visibility !== "sample");
    if (!hidden.length) return null;
    return (
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-fg-muted">隠しテスト {hidden.length} 件</summary>
        <ul className="mt-2 space-y-2 text-xs">
          {hidden.map((c) => (
            <li key={c.name} className="rounded border border-border p-2">
              <div className="font-mono">{c.name}</div>
              {c.stdin != null && <pre className="mt-1 font-mono whitespace-pre-wrap text-fg-muted">in: {c.stdin}</pre>}
              {c.expected != null && <pre className="font-mono whitespace-pre-wrap text-fg-muted">out: {c.expected}</pre>}
            </li>
          ))}
        </ul>
      </details>
    );
  }
  if (tests.kind === "web") {
    if (!tests.scenarios.length) return null;
    return (
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-fg-muted">判定シナリオ {tests.scenarios.length} 件</summary>
        <ul className="mt-2 space-y-1 text-xs">
          {tests.scenarios.map((s) => (
            <li key={s.name} className="flex gap-2">
              <span className="font-mono">{s.name}</span>
              <span className="text-fg-muted">{s.steps.length} ステップ{s.tags.length ? ` · ${s.tags.join(", ")}` : ""}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  }
  return null;
}
