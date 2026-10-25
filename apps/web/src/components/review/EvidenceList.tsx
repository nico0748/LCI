"use client";

import { fmtT, type Evidence, type Metrics } from "@lci/core/browser";
import { cx } from "@/components/ui";
import { describeEvidence, evidenceSeekable } from "./review-model";

/**
 * 根拠の一覧。移動できる根拠はボタン（押すと seek）、移動先の無い根拠（未実装・集計指標）は文だけ。
 * 種類 → 時刻 → 内容の順に並べる。
 */
export function EvidenceList({ evidence, metrics, onEvidence, className }: { evidence: Evidence[]; metrics: Metrics | null; onEvidence: (e: Evidence) => void; className?: string }) {
  if (!evidence.length) return <p className={cx("text-dns-13N-130 text-fg-muted", className)}>根拠の記録はありません（推測）。</p>;
  return (
    <ul className={cx("flex flex-col gap-0.5", className)}>
      {evidence.map((e, i) => {
        const d = describeEvidence(e);
        const body = (
          <>
            <span className="w-10 shrink-0 text-dns-13N-130 text-fg-muted">{d.kind}</span>
            {d.t != null && <span className="shrink-0 text-mono-12N-120 pt-[2px] text-fg-muted">{fmtT(d.t)}</span>}
            <span className="min-w-0 text-dns-14N-130 text-fg-body break-words">{d.text}</span>
          </>
        );
        return (
          <li key={i}>
            {evidenceSeekable(e, metrics) ? (
              <button type="button" onClick={() => onEvidence(e)} className="group flex w-full items-start gap-2 rounded-4 px-1 py-1 text-left focus-ring-compact can-hover:bg-hover">
                {body}
                <span aria-hidden className="ml-auto shrink-0 text-dns-13N-130 text-link group-hover:underline">
                  移動
                </span>
              </button>
            ) : (
              <div className="flex items-start gap-2 px-1 py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
