"use client";

import { AXES, fmtT, type Axis, type Evaluation, type Evidence, type FeedbackItem, type Metrics } from "@lci/core/browser";
import { Disclosure, EvalChip, StatusBadge, evalLevelOf } from "@/components/ui";
import { EvidenceList } from "./EvidenceList";
import { MetricsSummary } from "./MetricsSummary";
import { axisCode, isSpeculative, requirementLabel } from "./review-model";
import type { ReviewProblemInfo } from "./types";

/**
 * 再生ワークスペースの下に置く詳細（04 §2.1 の読み順 5）。
 * 軸別の根拠（1 軸 1 項目、既定で閉じる）→ 模範解答との比較 → 話すべきポイント（機械判定）→ 指標。
 * 話すべきポイントは「文字起こしの用語一致」で、Claude の要件チェック（実装の有無）とは別物なので、
 * 見出しと文言で区別する（S1-3: 並べると矛盾に見える問題）。
 */
export function ReviewDetails({
  ev,
  problem,
  metrics,
  numbers,
  openAxes,
  onToggleAxis,
  onEvidence,
  onSelectFeedback,
  onSeek,
}: {
  ev: Evaluation | null;
  problem: ReviewProblemInfo | null;
  metrics: Metrics | null;
  numbers: Map<string, number>;
  openAxes: Set<Axis>;
  onToggleAxis: (a: Axis, open: boolean) => void;
  onEvidence: (e: Evidence) => void;
  onSelectFeedback: (f: FeedbackItem) => void;
  onSeek: (t: number) => void;
}) {
  const practice = new Map(ev?.next_practice.map((n, i) => [n.axis, i + 1]) ?? []);
  return (
    <div className="flex flex-col gap-6">
      {ev && (
        <section aria-labelledby="review-axes-h" className="flex flex-col gap-2">
          <h2 id="review-axes-h" className="text-std-20B-150 text-fg">
            軸別の根拠
          </h2>
          <ul className="flex flex-col divide-y divide-border-subtle rounded-8 border border-border bg-surface">
            {AXES.map((a) => {
              const s = ev.scores[a.id];
              const related = ev.feedback.filter((f) => f.axis === a.id).sort((x, y) => (numbers.get(x.id) ?? 0) - (numbers.get(y.id) ?? 0));
              const p = practice.get(a.id);
              return (
                <li key={a.id} id={`axis-${a.id}`} className="scroll-mt-4 px-4 py-2">
                  <Disclosure
                    open={openAxes.has(a.id)}
                    onToggle={(e) => onToggleAxis(a.id, e.currentTarget.open)}
                    summary={
                      <span className="inline-flex flex-wrap items-center gap-x-2">
                        <span className="text-mono-12N-120 font-normal text-fg-muted">{axisCode(a.id)}</span>
                        {a.label}
                        <span className="text-mono-14N-150 text-fg">{s.score}</span>
                        <span className="text-dns-13N-130 font-normal text-fg-muted">/ 5</span>
                      </span>
                    }
                    meta={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="tabular-nums">
                          確信度 {Math.round(s.confidence * 100)}% · 重み {Math.round(a.weight * 100)}%
                        </span>
                        {isSpeculative(s) && <StatusBadge variant="outlined">推測</StatusBadge>}
                        {p && <StatusBadge tone="info" glyph={false}>次の練習 {p}</StatusBadge>}
                      </span>
                    }
                    summaryClassName="flex-wrap"
                  >
                    <div className="flex flex-col gap-3 pb-2">
                      <p className="max-w-[72ch] text-std-14N-170 text-fg-body">{s.rationale}</p>
                      <p className="max-w-[72ch] text-dns-13N-130 text-fg-muted">観点: {a.description}</p>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-dns-13N-130 text-fg-muted">根拠</h3>
                        <EvidenceList evidence={s.evidence} metrics={metrics} onEvidence={onEvidence} />
                      </div>
                      {related.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <h3 className="text-dns-13N-130 text-fg-muted">この軸の指摘</h3>
                          <ul className="flex flex-col gap-0.5">
                            {related.map((f) => {
                              const level = evalLevelOf(f.severity) ?? "minor";
                              return (
                                <li key={f.id}>
                                  <button type="button" onClick={() => onSelectFeedback(f)} className="flex w-full items-center gap-2 rounded-4 px-1 py-1 text-left focus-ring-compact can-hover:bg-hover">
                                    <EvalChip level={level}>#{numbers.get(f.id)}</EvalChip>
                                    <span className="text-mono-12N-120 text-fg-muted">{fmtT(f.t)}</span>
                                    <span className="min-w-0 text-dns-14N-130 text-fg-body">{f.title}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <MetricsSummary metrics={metrics} onSeek={onSeek} only={a.id} columns={2} className="max-w-3xl" />
                    </div>
                  </Disclosure>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ev && (
        <section aria-labelledby="review-more-h" className="flex flex-col gap-2">
          <h2 id="review-more-h" className="sr-only">
            評価の補足
          </h2>
          <div className="flex flex-col gap-1 rounded-8 border border-border bg-surface px-4 py-2">
            <Disclosure summary="模範解答との比較" meta={`カバー ${ev.model_answer_comparison.covered.length} · 不足 ${ev.model_answer_comparison.missing.length}`}>
              <div className="flex flex-col gap-2 pb-2">
                <CompareRow label="カバー" items={ev.model_answer_comparison.covered} ev={ev} problem={problem} />
                <CompareRow label="不足" items={ev.model_answer_comparison.missing} ev={ev} problem={problem} />
                <CompareRow label="模範解答以上" items={ev.model_answer_comparison.beyond_model} ev={ev} problem={problem} />
                {ev.model_answer_comparison.notes && <p className="max-w-[72ch] text-std-14N-170 text-fg-body">{ev.model_answer_comparison.notes}</p>}
              </div>
            </Disclosure>
            {ev.uncertainties.length > 0 && (
              <Disclosure summary="評価の不確実性" meta={`${ev.uncertainties.length} 件`}>
                <ul className="list-disc pb-2 pl-5 text-std-14N-170 text-fg-body">
                  {ev.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
            {problem && problem.talking_points.length > 0 && <TalkingPoints problem={problem} metrics={metrics} onSeek={onSeek} />}
          </div>
        </section>
      )}

      {!ev && problem && problem.talking_points.length > 0 && (
        <div className="rounded-8 border border-border bg-surface px-4 py-2">
          <TalkingPoints problem={problem} metrics={metrics} onSeek={onSeek} />
        </div>
      )}

      {ev && (
        <section aria-labelledby="review-metrics-all-h" className="flex flex-col gap-2">
          <h2 id="review-metrics-all-h" className="text-dns-16B-130 text-fg">
            指標 <span className="text-dns-13N-130 font-normal text-fg-muted">録画とログから決定的に計算</span>
          </h2>
          <MetricsSummary metrics={metrics} onSeek={onSeek} columns={6} />
        </section>
      )}
    </div>
  );
}

function CompareRow({ label, items, ev, problem }: { label: string; items: string[]; ev: Evaluation; problem: ReviewProblemInfo | null }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1 desktop:flex-row desktop:gap-3">
      <span className="w-24 shrink-0 text-dns-13N-130 text-fg-muted">{label}</span>
      <ul className="flex flex-col gap-0.5">
        {items.map((i) => (
          <li key={i} className="text-dns-14N-130 text-fg-body">
            {requirementLabel(i, ev, problem?.requirements)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TalkingPoints({ problem, metrics, onSeek }: { problem: ReviewProblemInfo; metrics: Metrics | null; onSeek: (t: number) => void }) {
  const hits = problem.talking_points.filter((tp) => metrics?.talking_point_hits.find((h) => h.id === tp.id)?.t != null).length;
  return (
    <Disclosure summary="話すべきポイント（文字起こしの用語一致）" meta={metrics ? `言及あり ${hits} / ${problem.talking_points.length}` : "処理後に判定"}>
      <div className="flex flex-col gap-2 pb-2">
        <p className="max-w-[72ch] text-dns-13N-130 text-fg-muted">
          用語が発話に出たかどうかの機械判定です。実装されたかどうかは上の「要件チェック」（Claude の判定）を見てください。
        </p>
        <ul className="flex flex-col gap-1.5">
          {problem.talking_points.map((tp) => {
            const hit = metrics?.talking_point_hits.find((h) => h.id === tp.id);
            const yes = hit?.t != null;
            return (
              <li key={tp.id} className="flex flex-col gap-0.5">
                <span className="flex items-start gap-2">
                  <StatusBadge variant={yes ? "filled" : "outlined"} className="mt-px w-[4.5rem] justify-center">
                    {metrics ? (yes ? "言及あり" : "言及なし") : "—"}
                  </StatusBadge>
                  <span className="text-dns-14N-130 text-fg-body">
                    {tp.text} <span className="text-dns-13N-130 text-fg-muted">重み {tp.weight}</span>
                  </span>
                </span>
                {hit?.quote && hit.t != null && (
                  <button type="button" onClick={() => onSeek(hit.t!)} className="ml-[5rem] flex items-start gap-2 self-start rounded-4 px-1 text-left focus-ring-compact can-hover:bg-hover">
                    <span className="text-mono-12N-120 pt-[2px] text-link underline underline-offset-[3px]">{fmtT(hit.t)}</span>
                    <span className="text-dns-13N-130 text-fg-muted">「{hit.quote}」</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Disclosure>
  );
}
