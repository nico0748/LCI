"use client";

import { useMemo, useState } from "react";
import { AXES, fmtT, type Axis, type Evaluation, type Evidence, type FeedbackItem, type Metrics, type Session } from "@lci/core/browser";
import { Radar } from "./Radar";
import { MetricsSummary } from "./MetricsSummary";
import { ReviewNotes } from "./ReviewNotes";
import { isSpeculative, severityColor } from "./pins";
import type { ReviewProblemInfo } from "./types";
import type { CodeHighlight } from "./CodeAtT";

/**
 * 右カラム: 評価パネル（03 §5.1）。
 * 評価が無ければ「Claude で評価する」と指標要約、あれば next_practice → 要件チェック → レーダー → 根拠 → フィードバック → 比較 の順。
 * 総合点は小さく（FR-E-09）。根拠の無い項目は「推測」バッジ。
 */

const AXIS_LABEL = Object.fromEntries(AXES.map((a) => [a.id, a.label])) as Record<Axis, string>;
const STATUS_STYLE = {
  implemented: { label: "実装あり", cls: "border-ok/60 text-ok" },
  mentioned_only: { label: "言及のみ", cls: "border-warn/70 text-warn" },
  missing: { label: "なし", cls: "border-danger/60 text-danger" },
} as const;

export function EvaluationPanel({
  sessionId,
  session,
  problem,
  metrics,
  duration,
  evaluations,
  index,
  onIndexChange,
  onEvaluationsChange,
  selectedPinId,
  onSelectFeedback,
  onSeek,
  onEvidence,
  onCodeRef,
  selectedAxis,
  onSelectAxis,
}: {
  sessionId: string;
  session: Session;
  problem: ReviewProblemInfo | null;
  metrics: Metrics | null;
  duration: number;
  evaluations: Evaluation[];
  index: number;
  onIndexChange: (i: number) => void;
  onEvaluationsChange: (evs: Evaluation[]) => void;
  selectedPinId: string | null;
  onSelectFeedback: (f: FeedbackItem) => void;
  onSeek: (t: number) => void;
  onEvidence: (e: Evidence) => void;
  onCodeRef: (ref: CodeHighlight) => void;
  selectedAxis: Axis | null;
  onSelectAxis: (a: Axis | null) => void;
}) {
  const ev = evaluations[index] ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpHint, setMcpHint] = useState(false);
  const ready = session.status === "ready";

  const evaluate = async () => {
    setBusy(true);
    setError(null);
    setMcpHint(false);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/evaluate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.status === 503) {
        setMcpHint(true);
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "ANTHROPIC_API_KEY 未設定");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const list = (await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/evaluations`).then((r) => r.json())) as Evaluation[];
      onEvaluationsChange(list);
      onIndexChange(list.length - 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const feedbackSorted = useMemo(() => (ev ? [...ev.feedback].sort((a, b) => a.t - b.t) : []), [ev]);

  return (
    <div className="space-y-4">
      {/* 評価の実行 / 切替 */}
      <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Claude 評価</h2>
          <div className="flex items-center gap-2">
            {evaluations.length > 1 && (
              <select value={index} onChange={(e) => onIndexChange(Number(e.target.value))} className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs" aria-label="評価の版">
                {evaluations.map((e, i) => (
                  <option key={i} value={i}>
                    #{i + 1} {new Date(e.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={evaluate}
              disabled={busy || !ready}
              className="rounded-md bg-accent text-accent-fg px-3 py-1.5 text-xs font-medium disabled:opacity-50 inline-flex items-center gap-2"
              title={ready ? undefined : "セッションの処理が完了してから評価できます"}
            >
              {busy && <span className="inline-block w-3 h-3 rounded-full border-2 border-accent-fg/40 border-t-accent-fg animate-spin" aria-hidden />}
              {busy ? "評価中…" : ev ? "再評価" : "Claude で評価する"}
            </button>
          </div>
        </div>
        {ev && (
          <p className="text-[11px] text-fg-muted font-mono">
            {ev.model} · {ev.route === "mcp" ? "MCP" : "API"} · rubric {ev.rubric_version} · {new Date(ev.created_at).toLocaleString("ja-JP")}
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        {mcpHint && (
          <div className="rounded border border-border bg-bg p-2 text-xs space-y-1">
            <p>Claude Desktop から MCP サーバ <code className="font-mono">lci</code> を使って評価できます。</p>
            <p className="text-fg-muted">
              アプリ内評価を使うには <code className="font-mono">.env.local</code> に <code className="font-mono">ANTHROPIC_API_KEY</code> を設定して再起動してください。MCP 経由の評価もこのセッションに保存され、ここに表示されます。
            </p>
          </div>
        )}
        {!ev && !ready && <p className="text-xs text-fg-muted">セッションの状態: {session.status}。処理が完了すると評価できます。</p>}
      </section>

      {ev && (
        <>
          {/* next_practice: 最上部に 3 枚（FR-U-16） */}
          {ev.next_practice.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-fg-muted">次にやること</h3>
              <ol className="space-y-2">
                {ev.next_practice.slice(0, 3).map((n, i) => (
                  <li key={i} className="rounded-lg border border-accent/40 bg-bg-elev p-3">
                    <div className="text-[11px] text-fg-muted mb-1">
                      {i + 1}. {AXIS_LABEL[n.axis]}
                    </div>
                    <p className="text-sm leading-relaxed">{n.action}</p>
                    {n.based_on.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {n.based_on.map((b) => {
                          const f = ev.feedback.find((x) => x.id === b);
                          return f ? (
                            <button key={b} type="button" onClick={() => onSelectFeedback(f)} className="text-[10px] font-mono rounded border border-border px-1 hover:text-accent">
                              {b} {fmtT(f.t)}
                            </button>
                          ) : (
                            <span key={b} className="text-[10px] font-mono text-fg-muted">
                              {b}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <p className="text-sm leading-relaxed rounded-lg border border-border bg-bg-elev p-3">{ev.summary}</p>

          {/* 要件チェックリスト */}
          {ev.requirement_checklist.length > 0 && (
            <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
              <h3 className="text-xs font-semibold text-fg-muted">要件チェック</h3>
              <ul className="space-y-1">
                {ev.requirement_checklist.map((r) => {
                  const st = STATUS_STYLE[r.status];
                  const target = r.code_ref ? r.code_ref.at : r.mentioned_at;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={target == null}
                        onClick={() => {
                          if (r.code_ref) onCodeRef(r.code_ref);
                          if (target != null) onSeek(target);
                        }}
                        className="w-full text-left flex items-start gap-2 rounded px-1 py-1 hover:bg-bg disabled:cursor-default"
                      >
                        <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 ${st.cls}`}>{st.label}</span>
                        <span className="text-sm flex-1">{r.label}</span>
                        {target != null && <span className="font-mono text-[10px] text-fg-muted pt-0.5">{fmtT(target)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* レーダー＋軸ごとの根拠 */}
          <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
            <Radar scores={ev.scores} overall={ev.scores.overall} selected={selectedAxis} onSelectAxis={(a) => onSelectAxis(selectedAxis === a ? null : a)} />
            <ul className="divide-y divide-border">
              {AXES.map((a) => {
                const s = ev.scores[a.id];
                const open = selectedAxis === a.id;
                const spec = isSpeculative(s);
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => onSelectAxis(open ? null : a.id)} className="w-full flex items-center gap-2 py-1.5 text-left" aria-expanded={open}>
                      <span className="text-sm flex-1">{a.label}</span>
                      {spec && <SpeculativeBadge />}
                      <span className="font-mono text-sm">{s.score}</span>
                      <span className="text-[10px] text-fg-muted w-8 text-right">{Math.round(s.confidence * 100)}%</span>
                    </button>
                    {open && (
                      <div className="pb-2 pl-1 space-y-1">
                        <p className="text-sm leading-relaxed">{s.rationale}</p>
                        <EvidenceList evidence={s.evidence} onEvidence={onEvidence} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* フィードバック一覧 */}
          <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
            <h3 className="text-xs font-semibold text-fg-muted">フィードバック（時系列）</h3>
            {feedbackSorted.length === 0 && <p className="text-xs text-fg-muted">フィードバックはありません。</p>}
            <ul className="space-y-1.5">
              {feedbackSorted.map((f) => {
                const sel = f.id === selectedPinId;
                return (
                  <li key={f.id} className={`rounded border ${sel ? "border-accent" : "border-border"} bg-bg`}>
                    <button type="button" onClick={() => onSelectFeedback(f)} className="w-full text-left px-2 py-1.5 flex items-start gap-2">
                      <span className="mt-1.5 inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: severityColor(f.severity) }} aria-hidden />
                      <span className="font-mono text-[11px] text-fg-muted pt-0.5 shrink-0">
                        {fmtT(f.t)}
                        {f.t_end != null && f.t_end > f.t ? `–${fmtT(f.t_end)}` : ""}
                      </span>
                      <span className="flex-1 text-sm">
                        {f.title}
                        <span className="ml-1 text-[10px] text-fg-muted">
                          {AXIS_LABEL[f.axis]} · {f.severity}
                        </span>
                      </span>
                      {isSpeculative(f) && <SpeculativeBadge />}
                    </button>
                    {sel && (
                      <div className="px-2 pb-2 space-y-1.5 text-sm">
                        <p className="leading-relaxed">{f.detail}</p>
                        {f.interviewer_question && (
                          <p className="rounded border border-border px-2 py-1 text-xs">
                            <span className="text-fg-muted">面接官なら聞く: </span>
                            {f.interviewer_question}
                          </p>
                        )}
                        <EvidenceList evidence={f.evidence} onEvidence={onEvidence} />
                        {f.code_ref && (
                          <button type="button" onClick={() => onCodeRef(f.code_ref!)} className="text-xs font-mono text-accent hover:underline">
                            コード {f.code_ref.file}:{f.code_ref.lines[0]}–{f.code_ref.lines[1]} @ {fmtT(f.code_ref.at)}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 模範解答との比較 */}
          <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2 text-sm">
            <h3 className="text-xs font-semibold text-fg-muted">模範解答との比較</h3>
            <Row label="カバー" items={ev.model_answer_comparison.covered} cls="text-ok" />
            <Row label="不足" items={ev.model_answer_comparison.missing} cls="text-danger" />
            <Row label="模範解答以上" items={ev.model_answer_comparison.beyond_model} cls="text-accent" />
            {ev.model_answer_comparison.notes && <p className="text-fg-muted text-xs leading-relaxed">{ev.model_answer_comparison.notes}</p>}
          </section>

          {ev.uncertainties.length > 0 && (
            <details className="text-xs text-fg-muted px-1">
              <summary className="cursor-pointer">評価の不確実性 {ev.uncertainties.length} 件</summary>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {ev.uncertainties.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {/* talking_points × 機械判定（FR-U-14） */}
      {problem && problem.talking_points.length > 0 && (
        <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
          <h3 className="text-xs font-semibold text-fg-muted">話すべきポイント</h3>
          <ul className="space-y-1.5">
            {problem.talking_points.map((tp) => {
              const hit = metrics?.talking_point_hits.find((h) => h.id === tp.id);
              const yes = !!hit?.t;
              return (
                <li key={tp.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 ${yes ? "border-ok/60 text-ok" : "border-border text-fg-muted"}`}>{metrics ? (yes ? "あり" : "なし") : "—"}</span>
                    <span className="flex-1">
                      {tp.text}
                      <span className="ml-1 text-[10px] text-fg-muted">重み {tp.weight}</span>
                    </span>
                  </div>
                  {hit?.quote && hit.t != null && (
                    <button type="button" onClick={() => onSeek(hit.t!)} className="mt-0.5 ml-8 text-left text-xs text-fg-muted hover:text-accent">
                      <span className="font-mono">{fmtT(hit.t)}</span> 「{hit.quote}」
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-fg-muted">「あり/なし」は文字起こしの用語一致による機械判定です。Claude の評価は上の要件チェックとフィードバックを参照してください。</p>
        </section>
      )}

      {/* 指標 */}
      <section className="rounded-lg border border-border bg-bg-elev p-3 space-y-2">
        <h3 className="text-xs font-semibold text-fg-muted">指標（決定的計算）</h3>
        <MetricsSummary metrics={metrics} duration={duration} onSeek={onSeek} />
      </section>

      {/* 解説・参照解（最後に開示） */}
      {problem && <ReviewNotes problemId={problem.id} language={session.problem.language} />}
    </div>
  );
}

function SpeculativeBadge() {
  return (
    <span className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-fg-muted" title="根拠が検証できていない、または confidence < 0.6">
      推測
    </span>
  );
}

function Row({ label, items, cls }: { label: string; items: string[]; cls: string }) {
  if (!items.length) return null;
  return (
    <div className="flex gap-2">
      <span className={`shrink-0 text-xs w-20 ${cls}`}>{label}</span>
      <span className="text-xs font-mono flex flex-wrap gap-1">
        {items.map((i) => (
          <span key={i} className="rounded border border-border px-1">
            {i}
          </span>
        ))}
      </span>
    </div>
  );
}

function EvidenceList({ evidence, onEvidence }: { evidence: Evidence[]; onEvidence: (e: Evidence) => void }) {
  if (!evidence.length) return <p className="text-[11px] text-fg-muted">根拠なし</p>;
  return (
    <ul className="space-y-0.5">
      {evidence.map((e, i) => (
        <li key={i}>
          <button type="button" onClick={() => onEvidence(e)} className="text-left text-xs hover:text-accent">
            {describeEvidence(e)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function describeEvidence(e: Evidence): string {
  switch (e.type) {
    case "transcript":
      return `発話 ${fmtT(e.t0)}–${fmtT(e.t1)} 「${e.quote}」`;
    case "edit":
      return `編集 ${fmtT(e.t)} ${e.file}${e.lines ? `:${e.lines[0]}–${e.lines[1]}` : ""}${e.detail ? ` ${e.detail}` : ""}`;
    case "edit_absence":
      return `未実装: ${e.symbol}`;
    case "metric":
      return `指標 ${e.name}${e.index != null ? `[${e.index}]` : ""}${e.value ? ` = ${e.value}` : ""}`;
    case "run":
      return `実行 ${e.run_id}${e.verdict ? ` ${e.verdict}` : ""}`;
    case "frame":
      return `画面 ${fmtT(e.t)}`;
  }
}
