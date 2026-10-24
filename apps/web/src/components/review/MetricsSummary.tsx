"use client";

import { fmtT, type Metrics } from "@lci/core/browser";

/**
 * 決定的に計算した指標の要約（03 §2.3）。数値は解釈を添えずに出す。解釈は評価（Claude）の役目。
 * フェーズ帯は 1 本の帯＋テキスト凡例（色だけに頼らない）。
 */
const PHASE_LABEL: Record<Metrics["phase_estimate"][number]["phase"], string> = {
  design: "設計",
  implement: "実装",
  verify: "検証",
  polish: "整形",
  idle: "停滞",
};
const PHASE_COLOR: Record<Metrics["phase_estimate"][number]["phase"], string> = {
  design: "var(--accent)",
  implement: "var(--fg-muted)",
  verify: "var(--ok)",
  polish: "var(--warn)",
  idle: "var(--border)",
};

export function MetricsSummary({ metrics, duration, onSeek }: { metrics: Metrics | null; duration: number; onSeek: (t: number) => void }) {
  if (!metrics) {
    return <p className="text-xs text-fg-muted">指標はセッションの処理完了後に表示されます。</p>;
  }
  const longest = metrics.silence_gt15s.reduce<Metrics["silence_gt15s"][number] | null>((a, b) => (!a || b.dur_s > a.dur_s ? b : a), null);
  const total = Math.max(1, duration);
  const phases = metrics.phase_estimate.filter((p) => p.t1 > p.t0);
  const used = new Set(phases.map((p) => p.phase));
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="rounded border border-border bg-bg p-2">
      <div className="text-[11px] text-fg-muted">{label}</div>
      <div className="font-mono text-sm">{value}</div>
      {hint && <div className="text-[10px] text-fg-muted">{hint}</div>}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="発話比率" value={pct(metrics.speech_ratio)} hint={`${Math.round(metrics.speech_total_s)} 秒 / ${Math.round(metrics.duration_s)} 秒`} />
        <Stat label="15 秒超の沈黙" value={`${metrics.silence_gt15s.length} 回`} hint={longest ? `最長 ${longest.dur_s.toFixed(0)} 秒` : undefined} />
        <Stat label="無発話で編集" value={pct(metrics.silent_edit_ratio)} />
        <Stat label="説明先行（中央値）" value={metrics.lead_time_s.median != null ? `${metrics.lead_time_s.median.toFixed(1)} 秒` : "—"} hint={`${metrics.lead_time_s.samples} 標本`} />
        <Stat label="実行回数" value={`${metrics.run_events.length} 回`} hint={metrics.run_events.length ? metrics.run_events.map((r) => r.verdict ?? r.mode).join(" ") : undefined} />
        <Stat label="方針変更" value={`${metrics.direction_changes.length} 回`} hint={metrics.paste_events ? `貼り付け ${metrics.paste_events} 回` : undefined} />
      </div>
      {phases.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-fg-muted">フェーズ推定</div>
          <div className="flex h-3 w-full overflow-hidden rounded bg-bg border border-border" role="img" aria-label={phases.map((p) => `${PHASE_LABEL[p.phase]} ${fmtT(p.t0)}–${fmtT(p.t1)}`).join("、")}>
            {phases.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSeek(p.t0)}
                title={`${PHASE_LABEL[p.phase]} ${fmtT(p.t0)}–${fmtT(p.t1)}`}
                className="h-full border-r border-bg-elev last:border-r-0"
                style={{ width: `${((p.t1 - p.t0) / total) * 100}%`, background: PHASE_COLOR[p.phase] }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-fg-muted">
            {(Object.keys(PHASE_LABEL) as (keyof typeof PHASE_LABEL)[])
              .filter((k) => used.has(k))
              .map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: PHASE_COLOR[k] }} />
                  {PHASE_LABEL[k]}
                </span>
              ))}
          </div>
        </div>
      )}
      {metrics.silence_gt15s.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-fg-muted">沈黙区間 {metrics.silence_gt15s.length} 件</summary>
          <ul className="mt-1 space-y-0.5">
            {metrics.silence_gt15s.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => onSeek(s.t0)} className="font-mono hover:text-accent">
                  {fmtT(s.t0)}–{fmtT(s.t1)}
                </button>{" "}
                <span className="text-fg-muted">
                  {s.dur_s.toFixed(0)} 秒 · {s.editing ? "編集あり" : "編集なし"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
