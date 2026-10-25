"use client";

import { useState } from "react";
import { fmtT, type Axis, type Evaluation, type FeedbackItem, type Metrics, type Session } from "@lci/core/browser";
import { Button, Card, Disclosure, Dl, EvalChip, EVAL_LABEL, NotificationBanner, Select, StatusBadge, evalLevelOf } from "@/components/ui";
import { AxisDotBars } from "./AxisDotBars";
import { MetricsSummary } from "./MetricsSummary";
import { AXIS_LABEL, axisCode, axisRows, metricLabel, requirementCounts } from "./review-model";
import type { CodeHighlight } from "./CodeAtT";

/**
 * 画面上部のサマリ（04 §2.1 の読み順 1–3）。
 * - 評価あり: 総評 1 文（総合点は小さく）→ 次の練習 3 件 → 要件チェック＋軸別スコア
 * - 評価なし（X12）: 評価の依頼（主ボタン）と指標を先頭に置き、すぐ下の再生で振り返れるようにする
 * ここから seek する操作は、親が再生ワークスペースを画面に入れてから行う（S1-1）。
 */
export function ReviewSummary({
  sessionId,
  session,
  metrics,
  evaluations,
  index,
  onIndexChange,
  onEvaluationsChange,
  numbers,
  onSelectFeedback,
  onCodeRef,
  onSeekTranscript,
  onSeek,
  onOpenAxis,
}: {
  sessionId: string;
  session: Session;
  metrics: Metrics | null;
  evaluations: Evaluation[];
  index: number;
  onIndexChange: (i: number) => void;
  onEvaluationsChange: (evs: Evaluation[], select: number) => void;
  numbers: Map<string, number>;
  onSelectFeedback: (f: FeedbackItem) => void;
  onCodeRef: (ref: CodeHighlight) => void;
  onSeekTranscript: (t: number) => void;
  onSeek: (t: number) => void;
  onOpenAxis: (a: Axis) => void;
}) {
  const ev = evaluations[index] ?? null;
  const evaluate = useEvaluate(sessionId, onEvaluationsChange);
  const ready = session.status === "ready";

  if (!ev) {
    return (
      <section aria-labelledby="review-summary-h" className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex max-w-[72ch] flex-col gap-1">
              <h2 id="review-summary-h" className="text-std-20B-150 text-fg">
                まだ評価していません
              </h2>
              <p className="text-std-16N-170 text-fg-body">
                {ready
                  ? "下の指標と再生で自分の振り返りを済ませてから、Claude に評価を依頼できます。評価には 30〜60 秒ほどかかります。"
                  : "録画の再 mux・文字起こし・指標の計算が終わると評価を依頼できます。そのあいだも記録済みの範囲は再生できます。"}
              </p>
            </div>
            <EvaluateButton evaluate={evaluate} ready={ready} label="Claude で評価する" variant="primary" />
          </div>
          <EvaluateFeedback evaluate={evaluate} />
        </Card>
        <section aria-labelledby="review-metrics-h" className="flex flex-col gap-2">
          <h2 id="review-metrics-h" className="text-dns-16B-130 text-fg">
            指標 <span className="text-dns-13N-130 font-normal text-fg-muted">録画とログから決定的に計算（評価の前でも読める）</span>
          </h2>
          <MetricsSummary metrics={metrics} onSeek={onSeek} columns={6} />
        </section>
      </section>
    );
  }

  const rows = axisRows(ev);
  const req = requirementCounts(ev.requirement_checklist);
  const fbById = new Map(ev.feedback.map((f) => [f.id, f]));

  return (
    <section aria-labelledby="review-summary-h" className="flex flex-col gap-4">
      {/* 1. 総評 */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between desktop:gap-8">
          <div className="flex min-w-0 max-w-[72ch] flex-1 flex-col gap-1">
            <h2 id="review-summary-h" className="text-dns-14B-130 text-fg-muted">
              総評
            </h2>
            <p className="text-std-20B-150 text-fg">{ev.summary}</p>
          </div>
          <div className="flex shrink-0 flex-row flex-wrap items-center gap-3 desktop:flex-col desktop:items-end desktop:gap-2">
            <p className="text-dns-14N-130 text-fg-body">
              総合 <span className="text-mono-14N-150 font-bold text-fg">{ev.scores.overall.toFixed(1)}</span> / 5
              <span className="text-dns-13N-130 text-fg-muted">（重み付き平均）</span>
            </p>
            <EvaluateButton evaluate={evaluate} ready={ready} label="再評価" variant="secondary" />
          </div>
        </div>
        <EvaluateFeedback evaluate={evaluate} />
        <Disclosure summary="評価の詳細" meta={`${ev.model} · ${new Date(ev.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}`}>
          <div className="flex flex-col gap-3">
            <Dl
              items={[
                { term: "モデル", description: <span className="text-mono-13N-150">{ev.model}</span> },
                { term: "経路", description: ev.route === "mcp" ? "MCP（Claude Desktop）" : "アプリ内 API" },
                { term: "ルーブリック", description: <span className="text-mono-13N-150">{ev.rubric_version}</span> },
                { term: "作成日時", description: new Date(ev.created_at).toLocaleString("ja-JP") },
                { term: "入力", description: `発話 ${ev.input_digest.transcript_segments} · 編集 ${ev.input_digest.edit_events} · 画面 ${ev.input_digest.frames}`, numeric: true },
              ]}
            />
            {evaluations.length > 1 && (
              <label className="flex max-w-xs flex-col gap-1 text-dns-13N-130 text-fg-muted">
                表示する評価の版
                <Select value={index} onChange={(e) => onIndexChange(Number(e.target.value))}>
                  {evaluations.map((e, i) => (
                    <option key={i} value={i}>
                      #{i + 1} {new Date(e.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </Disclosure>
      </Card>

      {/* 2. 次の練習 */}
      {ev.next_practice.length > 0 && (
        <section aria-labelledby="review-next-h" className="flex flex-col gap-2">
          <h2 id="review-next-h" className="text-dns-16B-130 text-fg">
            次の練習
          </h2>
          <ol className="grid gap-3 desktop:grid-cols-3">
            {ev.next_practice.slice(0, 3).map((n, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-8 border border-border bg-surface p-4">
                <span className="flex items-center gap-2 text-dns-13N-130 text-fg-muted">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-mono-12N-120 text-on-accent" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="text-mono-12N-120">{axisCode(n.axis)}</span>
                  {AXIS_LABEL[n.axis]}
                </span>
                <p className="text-std-16N-170 text-fg">{n.action}</p>
                {n.based_on.length > 0 && (
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-dns-13N-130 text-fg-muted">根拠</span>
                    {n.based_on.map((b) => {
                      const f = fbById.get(b);
                      const level = f ? evalLevelOf(f.severity) : null;
                      if (f && level)
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => onSelectFeedback(f)}
                            className="inline-flex min-h-6 items-center gap-1.5 rounded-4 px-0.5 focus-ring-compact can-hover:bg-hover"
                            aria-label={`指摘 #${numbers.get(f.id)} ${EVAL_LABEL.feedback[level]} ${fmtT(f.t)} ${f.title} を再生`}
                          >
                            <EvalChip level={level}>#{numbers.get(f.id)}</EvalChip>
                            <span className="text-mono-12N-120 text-link underline underline-offset-[3px]">{fmtT(f.t)}</span>
                          </button>
                        );
                      return (
                        <StatusBadge key={b} variant="outlined">
                          {b.startsWith("metrics.") ? `指標: ${metricLabel(b)}` : b}
                        </StatusBadge>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 3. 要件チェック＋軸別スコア */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-dns-16B-130 text-fg">
            要件チェック
            <span className="text-dns-13N-130 font-normal text-fg-muted tabular-nums">
              実装あり {req.implemented} / {req.total}
            </span>
          </h2>
          {ev.requirement_checklist.length === 0 ? (
            <p className="text-std-14N-170 text-fg-muted">要件チェックはありません。</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {ev.requirement_checklist.map((r) => {
                const level = evalLevelOf(r.status) ?? "minor";
                return (
                  <li key={r.id} className="flex flex-col gap-1.5 py-2 desktop:flex-row desktop:items-center desktop:gap-3">
                    <span className="flex min-w-0 flex-1 items-start gap-2">
                      <EvalChip level={level} kind="requirement" className="mt-px w-[6.5rem] justify-start" />
                      <span className="min-w-0 text-dns-14N-130 text-fg-body">{r.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 pl-[7rem] desktop:pl-0">
                      {r.mentioned_at != null && (
                        <Button size="2xs" variant="tertiary" onClick={() => onSeekTranscript(r.mentioned_at!)} aria-label={`${r.label} の発話 ${fmtT(r.mentioned_at)} を再生`}>
                          発話 <span className="text-mono-12N-120">{fmtT(r.mentioned_at)}</span>
                        </Button>
                      )}
                      {r.code_ref && (
                        <Button size="2xs" variant="tertiary" onClick={() => onCodeRef(r.code_ref!)} aria-label={`${r.label} のコード ${fmtT(r.code_ref.at)} を表示`}>
                          コード <span className="text-mono-12N-120">{fmtT(r.code_ref.at)}</span>
                        </Button>
                      )}
                      {r.mentioned_at == null && !r.code_ref && <span className="text-dns-13N-130 text-fg-muted">記録なし</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-dns-16B-130 text-fg">
            軸別スコア <span className="text-dns-13N-130 font-normal text-fg-muted">1–5、行を押すと根拠を開く</span>
          </h2>
          <AxisDotBars rows={rows} onOpenAxis={onOpenAxis} />
        </Card>
      </div>
    </section>
  );
}

// ---- 評価の依頼 ------------------------------------------------------------

type EvaluateState = ReturnType<typeof useEvaluate>;

function useEvaluate(sessionId: string, onDone: (evs: Evaluation[], select: number) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcpHint, setMcpHint] = useState(false);
  const run = async () => {
    setBusy(true);
    setError(null);
    setMcpHint(false);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/evaluate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.status === 503) {
        setMcpHint(true);
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "ANTHROPIC_API_KEY が設定されていません");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const list = (await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/evaluations`).then((r) => r.json())) as Evaluation[];
      onDone(list, list.length - 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, mcpHint, run };
}

function EvaluateButton({ evaluate, ready, label, variant }: { evaluate: EvaluateState; ready: boolean; label: string; variant: "primary" | "secondary" }) {
  return (
    <div className="flex flex-col items-start gap-1 desktop:items-end">
      <Button variant={variant} size={variant === "primary" ? "md" : "sm"} onClick={evaluate.run} loading={evaluate.busy} disabled={!ready} aria-describedby={!ready ? "evaluate-why" : undefined}>
        {evaluate.busy ? "評価しています" : label}
      </Button>
      {!ready && (
        <span id="evaluate-why" className="text-dns-13N-130 text-fg-muted">
          処理が終わると押せます
        </span>
      )}
    </div>
  );
}

function EvaluateFeedback({ evaluate }: { evaluate: EvaluateState }) {
  if (evaluate.busy) return <p role="status" className="text-dns-14N-130 text-fg-muted">Claude が評価しています（30〜60 秒ほど）。このページはそのまま操作できます。</p>;
  if (!evaluate.error) return null;
  if (evaluate.mcpHint)
    return (
      <NotificationBanner tone="info" title="アプリ内の評価は使えません（API キー未設定）">
        Claude Desktop から MCP サーバ <code className="text-mono-13N-150">lci</code> を使って評価できます。MCP 経由の評価もこのセッションに保存され、ここに表示されます。アプリ内で評価するには{" "}
        <code className="text-mono-13N-150">.env.local</code> に <code className="text-mono-13N-150">ANTHROPIC_API_KEY</code> を設定して再起動してください。
      </NotificationBanner>
    );
  return (
    <NotificationBanner tone="danger" title="評価に失敗しました">
      {evaluate.error}
    </NotificationBanner>
  );
}
