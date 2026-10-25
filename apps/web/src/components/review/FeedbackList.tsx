"use client";

import { useEffect, useRef } from "react";
import { fmtT, type Evidence, type FeedbackItem, type Metrics } from "@lci/core/browser";
import { Button, EvalChip, EVAL_LABEL, StatusBadge, cx, evalLevelOf } from "@/components/ui";
import { AXIS_LABEL, fmtRange, isSpeculative } from "./review-model";
import { EvidenceList } from "./EvidenceList";
import type { CodeHighlight } from "./CodeAtT";

/**
 * 指摘の一覧（ワークスペース右列）。タイムラインのピンと同じ番号・同じ形で時刻順に並べ、表ビューを兼ねる（04 §2.2 C）。
 * 選択中の指摘だけ本文・面接官の問い・根拠を開く。選択が変わったら、リストの中だけをスクロールして見える位置に出す。
 * 行の地は hover / 選択で変わるので、形は面の上に直接描かず EvalChip（-subtle の地）で出す（X1: 図形は surface 上だけ）。
 */
export function FeedbackList({
  feedback,
  numbers,
  selectedId,
  metrics,
  onSelect,
  onEvidence,
  onCodeRef,
  className,
}: {
  feedback: FeedbackItem[];
  numbers: Map<string, number>;
  selectedId: string | null;
  metrics: Metrics | null;
  onSelect: (f: FeedbackItem) => void;
  onEvidence: (e: Evidence) => void;
  onCodeRef: (ref: CodeHighlight) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const sorted = [...feedback].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));

  useEffect(() => {
    if (!selectedId) return;
    const box = listRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-fb="${CSS.escape(selectedId)}"]`);
    if (!box || !el) return;
    const top = el.offsetTop;
    if (top < box.scrollTop || top + Math.min(el.offsetHeight, box.clientHeight) > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - 8);
  }, [selectedId]);

  return (
    <div className={cx("flex min-h-0 flex-col overflow-hidden rounded-8 border border-border bg-surface", className)}>
      <div className="flex min-h-10 items-center gap-2 border-b border-border px-3 py-1">
        <h3 className="text-dns-14B-130 text-fg">
          指摘 <span className="text-dns-13N-130 font-normal text-fg-muted tabular-nums">{feedback.length} 件 · 時刻順</span>
        </h3>
      </div>
      {sorted.length === 0 ? (
        <p className="p-3 text-std-14N-170 text-fg-muted">指摘はありません。</p>
      ) : (
        <ol ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto p-1.5">
          {sorted.map((f) => {
            const level = evalLevelOf(f.severity) ?? "minor";
            const n = numbers.get(f.id);
            const sel = f.id === selectedId;
            return (
              <li key={f.id} data-fb={f.id} className={cx("rounded-6", sel && "bg-selected shadow-[inset_2px_0_0_var(--accent)]")}>
                <button
                  type="button"
                  onClick={() => onSelect(f)}
                  aria-expanded={sel}
                  className={cx("flex w-full flex-col gap-1 rounded-6 px-2 py-2 text-left focus-ring-inset", !sel && "can-hover:bg-hover")}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <EvalChip level={level}>
                      <span className="tabular-nums">#{n}</span> {EVAL_LABEL.feedback[level]}
                    </EvalChip>
                    <span className="text-mono-12N-120 text-fg-muted">{fmtRange(f.t, f.t_end)}</span>
                    {isSpeculative(f) && (
                      <StatusBadge variant="outlined" title="根拠が検証できていない、または確信度が低い">
                        推測
                      </StatusBadge>
                    )}
                  </span>
                  <span className="text-dns-14B-130 text-fg">{f.title}</span>
                  <span className="text-dns-13N-130 text-fg-muted">{AXIS_LABEL[f.axis]}</span>
                </button>
                {sel && (
                  <div className="flex flex-col gap-2 px-2 pb-3">
                    {f.detail && <p className="text-std-14N-170 text-fg-body">{f.detail}</p>}
                    {f.interviewer_question && (
                      <p className="rounded-6 border border-border bg-surface px-2.5 py-1.5 text-std-14N-170 text-fg-body">
                        <span className="text-dns-13N-130 text-fg-muted">面接官ならこう聞く: </span>
                        {f.interviewer_question}
                      </p>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-dns-13N-130 text-fg-muted">根拠</span>
                      <EvidenceList evidence={f.evidence} metrics={metrics} onEvidence={onEvidence} className="rounded-6 bg-surface p-1" />
                    </div>
                    {f.code_ref && (
                      <Button size="2xs" variant="tertiary" className="self-start" onClick={() => onCodeRef(f.code_ref!)}>
                        コードを見る · {f.code_ref.lines[0]}–{f.code_ref.lines[1]} 行 @ {fmtT(f.code_ref.at)}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
