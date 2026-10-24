import { RequirementStatus, weightedOverall, type Evaluation, type TranscriptSegment } from "@lci/core";

/**
 * 評価結果の後処理（03 §7「幻覚引用」「お世辞バイアス」対策）。
 * - transcript 引用が実在するかを照合し、無ければ feedback を speculative に降格する
 * - overall はアプリ側で重み付き平均を再計算する（モデルの算術を信用しない）
 * - 反フラッタリング規則の違反は直さずに uncertainties へ記録する（勝手に書き換えると評価の意味が変わるため）
 */

/** 句読点・空白・記号を落として比較する（Whisper の句読点ゆれを吸収） */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s、。，．,.!?！？「」『』（）()【】・…ー〜~\-—:：;；"'`]/g, "");
}

function lcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[b.length]!;
}

/**
 * quote が transcript に存在する度合い（0–1）。完全一致（部分文字列）なら 1。
 * それ以外はセグメント境界から始まる窓（quote 長の 1.5 倍）との最長共通部分列 / quote 長の最大値。
 */
export function quoteOverlap(quote: string, segments: Pick<TranscriptSegment, "text">[]): number {
  const q = normalizeForMatch(quote);
  if (!q) return 0;
  const texts = segments.map((s) => normalizeForMatch(s.text)).filter(Boolean);
  const all = texts.join("");
  if (all.includes(q)) return 1;
  const win = Math.ceil(q.length * 1.5);
  let best = 0;
  let offset = 0;
  const starts: number[] = [];
  for (const t of texts) {
    starts.push(offset);
    offset += t.length;
  }
  for (const st of starts) {
    for (const s of [st, Math.max(0, st - Math.floor(q.length / 2))]) {
      const w = all.slice(s, s + win);
      best = Math.max(best, lcsLength(q, w) / q.length);
      if (best >= 1) return 1;
    }
  }
  return best;
}

export const QUOTE_THRESHOLD = 0.7;

export interface VerifyResult {
  evaluation: Evaluation;
  demoted: string[];
  notes: string[];
}

export function verifyEvaluation(ev: Evaluation, segments: TranscriptSegment[], threshold = QUOTE_THRESHOLD): VerifyResult {
  const speech = segments.filter((s) => s.text.trim());
  const demoted: string[] = [];
  const notes: string[] = [];
  const ok = (quote: string) => speech.length > 0 && quoteOverlap(quote, speech) >= threshold;

  const feedback = ev.feedback.map((f) => {
    const bad = f.evidence.filter((e) => e.type === "transcript" && !ok(e.quote));
    const noEvidence = f.evidence.length === 0;
    if ((bad.length || noEvidence) && !f.speculative) {
      demoted.push(f.id);
      return { ...f, speculative: true };
    }
    return f;
  });
  if (demoted.length) notes.push(`文字起こしと照合できない引用、または証拠なしのため「推測」に降格: ${demoted.join(", ")}`);

  const scores = { ...ev.scores };
  for (const key of Object.keys(scores) as (keyof typeof scores)[]) {
    if (key === "overall") continue;
    const s = scores[key];
    const bad = s.evidence.filter((e) => e.type === "transcript" && !ok(e.quote));
    if (bad.length) {
      scores[key] = { ...s, confidence: Math.min(s.confidence, 0.5) };
      notes.push(`${key}: 照合できない引用 ${bad.length} 件（confidence を 0.5 以下に制限）`);
    }
  }
  const overall = weightedOverall(scores);

  // 反フラッタリング規則のチェック（記録のみ）
  const positives = feedback.filter((f) => f.severity === "positive").length;
  if (positives > 2) notes.push(`positive が ${positives} 件（規則は 2 件以内）`);
  const allImplemented = ev.requirement_checklist.length > 0 && ev.requirement_checklist.every((r) => r.status === RequirementStatus.enum.implemented);
  if (overall >= 4.5 && !allImplemented) notes.push(`overall ${overall} だが要件チェックに未実装があります（4.5 以上は全 implemented のときのみ）`);

  return {
    evaluation: { ...ev, feedback, scores: { ...scores, overall }, uncertainties: [...ev.uncertainties, ...notes.map((n) => `[自動検証] ${n}`)] },
    demoted,
    notes,
  };
}
