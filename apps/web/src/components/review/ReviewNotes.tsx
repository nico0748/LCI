"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_LABEL, type Language, type Problem } from "@lci/core/browser";
import { Disclosure, LoadingText, NotificationBanner } from "@/components/ui";
import { Markdown } from "./markdown";

type Revealed = Problem & { reference_solution_texts?: Record<string, string> };

/**
 * 振り返り用解説・面接官メモ・参照解・隠しテスト（04 §2.1 の読み順 6）。レビュー画面でだけ `?reveal=1` で取得する（FR-U-15）。
 * 既定で閉じておき、開く操作を 1 回挟む（自分の振り返りを先に済ませるため）。開いたときに初めて取得する。
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
    <section aria-labelledby="review-notes-h" className="rounded-8 border border-border bg-surface px-4 py-3">
      <h2 id="review-notes-h" className="sr-only">
        解説と参照解
      </h2>
      <Disclosure summary="振り返り用解説・参照解・隠しテスト" meta="自分で振り返ってから開く" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <div className="flex flex-col gap-5 pb-2">
          {err && <NotificationBanner tone="danger" title="解説を読み込めませんでした">{err}</NotificationBanner>}
          {!p && !err && <LoadingText />}
          {p && (
            <>
              {p.body.review_notes ? (
                <div className="flex max-w-[80ch] flex-col gap-1">
                  <h3 className="text-dns-14B-130 text-fg">振り返り用解説</h3>
                  <Markdown text={p.body.review_notes} className="text-fg-body" />
                </div>
              ) : (
                <p className="text-std-14N-170 text-fg-muted">この問題には解説がありません。</p>
              )}
              {p.body.interviewer_notes && (
                <Disclosure summary="面接官メモ（面接官が見ていた観点）">
                  <Markdown text={p.body.interviewer_notes} className="max-w-[80ch] text-fg-body" />
                </Disclosure>
              )}
              {(p.meta.rubric_hints.red_flags.length > 0 || p.meta.rubric_hints.checklist.length > 0) && (
                <Disclosure summary="採点ヒント">
                  <div className="flex max-w-[80ch] flex-col gap-2 text-std-14N-170 text-fg-body">
                    {p.meta.rubric_hints.correctness && (
                      <p>
                        <span className="text-fg-muted">正確性: </span>
                        {p.meta.rubric_hints.correctness}
                      </p>
                    )}
                    {p.meta.rubric_hints.explanation && (
                      <p>
                        <span className="text-fg-muted">説明: </span>
                        {p.meta.rubric_hints.explanation}
                      </p>
                    )}
                    {p.meta.rubric_hints.time_management && (
                      <p>
                        <span className="text-fg-muted">時間: </span>
                        {p.meta.rubric_hints.time_management}
                      </p>
                    )}
                    {p.meta.rubric_hints.red_flags.length > 0 && (
                      <div>
                        <div className="text-fg-muted">レッドフラグ</div>
                        <ul className="list-disc pl-5">
                          {p.meta.rubric_hints.red_flags.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Disclosure>
              )}
              {primary && (
                <div className="flex flex-col gap-2">
                  <h3 className="flex flex-wrap items-baseline gap-x-2 text-dns-14B-130 text-fg">
                    参照解（{LANGUAGE_LABEL[primary]}）
                    {solLangs.length > 1 && (
                      <span className="text-dns-13N-130 font-normal text-fg-muted">
                        他: {solLangs.filter((l) => l !== primary).map((l) => LANGUAGE_LABEL[l]).join(", ")}
                      </span>
                    )}
                  </h3>
                  <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-6 border border-border bg-sunken p-3 text-mono-13N-150 text-fg-body" tabIndex={0}>
                    <code>{solutions[primary]}</code>
                  </pre>
                  {solLangs
                    .filter((l) => l !== primary)
                    .map((l) => (
                      <Disclosure key={l} summary={`${LANGUAGE_LABEL[l]} の参照解`}>
                        <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-6 border border-border bg-sunken p-3 text-mono-13N-150 text-fg-body" tabIndex={0}>
                          <code>{solutions[l]}</code>
                        </pre>
                      </Disclosure>
                    ))}
                </div>
              )}
              <HiddenTests tests={p.tests} />
            </>
          )}
        </div>
      </Disclosure>
    </section>
  );
}

function HiddenTests({ tests }: { tests: Problem["tests"] }) {
  if (tests.kind === "stdio") {
    const hidden = tests.cases.filter((c) => c.visibility !== "sample");
    if (!hidden.length) return null;
    return (
      <Disclosure summary="隠しテスト" meta={`${hidden.length} 件`}>
        <ul className="flex flex-col gap-2">
          {hidden.map((c) => (
            <li key={c.name} className="rounded-6 border border-border p-2">
              <div className="text-mono-13N-150 text-fg">{c.name}</div>
              {c.stdin != null && <pre className="mt-1 whitespace-pre-wrap text-mono-13N-150 text-fg-muted">in: {c.stdin}</pre>}
              {c.expected != null && <pre className="whitespace-pre-wrap text-mono-13N-150 text-fg-muted">out: {c.expected}</pre>}
            </li>
          ))}
        </ul>
      </Disclosure>
    );
  }
  if (tests.kind === "web") {
    if (!tests.scenarios.length) return null;
    return (
      <Disclosure summary="判定シナリオ" meta={`${tests.scenarios.length} 件`}>
        <ul className="flex flex-col gap-1">
          {tests.scenarios.map((s) => (
            <li key={s.name} className="flex flex-wrap gap-x-2">
              <span className="text-mono-13N-150 text-fg">{s.name}</span>
              <span className="text-dns-13N-130 text-fg-muted">
                {s.steps.length} ステップ{s.tags.length ? ` · ${s.tags.join(", ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Disclosure>
    );
  }
  return null;
}
