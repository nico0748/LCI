import type { Evaluation, Event, FeedbackItem } from "@lci/core/browser";
import type { Pin } from "./types";

/**
 * タイムラインに置くピンの導出と、評価 JSON の時刻の正規化。
 */

/**
 * 評価 JSON の t は ms が規約（CLAUDE.md）だが、要件書 03 §5 の例は秒で書かれている。
 * 生成元（API / MCP）のゆれに備え、全時刻がセッション長（秒）に収まるなら秒とみなして ms に直す。
 * セッション長が 1 分未満のときは判定しない。
 */
export function normalizeEvalTimes(ev: Evaluation, durationMs: number): Evaluation {
  if (durationMs < 60_000) return ev;
  const ts: number[] = [];
  for (const f of ev.feedback) {
    ts.push(f.t);
    if (f.t_end != null) ts.push(f.t_end);
    if (f.code_ref) ts.push(f.code_ref.at);
  }
  for (const r of ev.requirement_checklist) {
    if (r.mentioned_at != null) ts.push(r.mentioned_at);
    if (r.code_ref) ts.push(r.code_ref.at);
  }
  if (ts.length === 0) return ev;
  const max = Math.max(...ts);
  const looksLikeSeconds = max <= durationMs / 1000 + 1;
  if (!looksLikeSeconds) return ev;
  const k = 1000;
  const evd = (e: FeedbackItem["evidence"][number]) => {
    switch (e.type) {
      case "transcript":
        return { ...e, t0: e.t0 * k, t1: e.t1 * k };
      case "edit":
      case "frame":
        return { ...e, t: e.t * k };
      default:
        return e;
    }
  };
  return {
    ...ev,
    feedback: ev.feedback.map((f) => ({
      ...f,
      t: f.t * k,
      t_end: f.t_end != null ? f.t_end * k : undefined,
      code_ref: f.code_ref ? { ...f.code_ref, at: f.code_ref.at * k } : undefined,
      evidence: f.evidence.map(evd),
    })),
    requirement_checklist: ev.requirement_checklist.map((r) => ({
      ...r,
      mentioned_at: r.mentioned_at != null ? r.mentioned_at * k : undefined,
      code_ref: r.code_ref ? { ...r.code_ref, at: r.code_ref.at * k } : undefined,
    })),
    scores: Object.fromEntries(
      Object.entries(ev.scores).map(([key, v]) => (typeof v === "number" ? [key, v] : [key, { ...v, evidence: v.evidence.map(evd) }])),
    ) as Evaluation["scores"],
  };
}

/** evidence が無い、または confidence が低い項目は「推測」（03 §5.1） */
export function isSpeculative(item: { speculative?: boolean; confidence?: number; evidence?: unknown[] }): boolean {
  if (item.speculative) return true;
  if (item.confidence != null && item.confidence < 0.6) return true;
  if (item.evidence && item.evidence.length === 0) return true;
  return false;
}

export function feedbackPins(ev: Evaluation | null | undefined): Pin[] {
  if (!ev) return [];
  return ev.feedback.map((f) => ({ id: f.id, t: f.t, kind: "feedback", severity: f.severity, label: f.title }));
}

export function eventPins(events: Event[]): Pin[] {
  const out: Pin[] = [];
  for (const e of events) {
    if (e.type === "run") out.push({ id: `run:${e.run_id}`, t: e.t, kind: "run", label: `${e.mode}${e.verdict ? ` ${e.verdict}` : ""}`, verdict: e.verdict });
    else if (e.type === "followup_shown") out.push({ id: `fu:${e.seq}`, t: e.t, kind: "followup", label: e.text });
  }
  return out;
}

export function sortPins(pins: Pin[]): Pin[] {
  return [...pins].sort((a, b) => a.t - b.t);
}

/** j/k 用: 現在時刻の次・前のピン（同時刻は飛ばす） */
export function nextPin(pins: Pin[], t: number): Pin | undefined {
  return sortPins(pins).find((p) => p.t > t + 1);
}
export function prevPin(pins: Pin[], t: number): Pin | undefined {
  const s = sortPins(pins);
  for (let i = s.length - 1; i >= 0; i--) if (s[i]!.t < t - 1) return s[i];
  return undefined;
}

export function severityColor(sev: Pin["severity"] | undefined): string {
  switch (sev) {
    case "major":
      return "var(--danger)";
    case "minor":
      return "var(--warn)";
    case "positive":
      return "var(--ok)";
    default:
      return "var(--fg-muted)";
  }
}

export function verdictColor(v: string | undefined): string {
  if (!v) return "var(--fg-muted)";
  return v === "AC" || v === "PASS" ? "var(--ok)" : "var(--danger)";
}
