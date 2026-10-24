/**
 * セッション時計 t（ms）と録画メディア時刻の相互変換（01 §2.5, D6）。
 *   t = t_rec_start + media_ms * scale
 * recorder に t_rec_start が無い（録画開始イベントが欠けた）場合は 0 とみなす。
 */
export interface RecorderClock {
  t_rec_start?: number;
  scale?: number;
  media_duration_ms?: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** t → メディア時刻（ms）。録画開始前は 0、録画長を超えたら末尾に丸める */
export function tToMedia(t: number, rec: RecorderClock): number {
  const start = rec.t_rec_start ?? 0;
  const scale = rec.scale && rec.scale > 0 ? rec.scale : 1;
  const ms = (t - start) / scale;
  const max = rec.media_duration_ms ?? Infinity;
  return clamp(ms, 0, max);
}

/** メディア時刻（ms）→ t */
export function mediaToT(mediaMs: number, rec: RecorderClock): number {
  const start = rec.t_rec_start ?? 0;
  const scale = rec.scale && rec.scale > 0 ? rec.scale : 1;
  return start + mediaMs * scale;
}

/** セッション全体の長さ（ms）。ended_t が無ければ記録の末尾から推定する */
export function sessionDuration(input: { ended_t?: number; lastEventT?: number; recorders?: RecorderClock[] }): number {
  const candidates: number[] = [];
  if (input.ended_t != null) candidates.push(input.ended_t);
  if (input.lastEventT != null) candidates.push(input.lastEventT);
  for (const r of input.recorders ?? []) {
    if (r.media_duration_ms != null) candidates.push(mediaToT(r.media_duration_ms, r));
  }
  return Math.max(1000, ...candidates);
}

/** mm:ss.d（スクラバ表示用。fmtT より 1 桁細かい） */
export function fmtTFine(ms: number): string {
  const s = Math.max(0, ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** 時系列（t 昇順）の中で t 以下の最後の要素の添字。無ければ -1 */
export function indexAtOrBefore<T>(items: T[], t: number, getT: (x: T) => number): number {
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (getT(items[mid]!) <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
