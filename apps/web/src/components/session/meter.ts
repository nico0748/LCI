/**
 * マイクの音量（S2 のメーター、S3 の無音検知）。純関数（session-helpers.test.ts）。
 * 旧実装の「RMS × 6」をやめ、dBFS で目盛りを決める: -60 dB〜-10 dB を 12 段に割り、目安線は -40 dB。
 * 普通の声（口元 30〜50cm）は -30〜-20 dB 前後、静かな部屋の雑音は -55 dB 以下になる。
 */

export const METER_SEGMENTS = 12;
export const METER_FLOOR_DB = -60;
export const METER_CEIL_DB = -10;
/** 「声が届いている」とみなす目安 */
export const VOICE_DB = -40;
/** 声を検出したとみなすまでの、目安を超えた時間の合計 */
export const VOICE_CONFIRM_MS = 1000;
/** S3 の無音検知（FR-C-06）: この音量未満が 10 秒続いたら知らせる */
export const SILENCE_DB = -50;
export const SILENCE_MS = 10_000;

export function rmsToDb(rms: number): number {
  if (!(rms > 0)) return -Infinity;
  return 20 * Math.log10(rms);
}

/** 点灯するセグメント数（0〜12） */
export function levelSegments(rms: number): number {
  const db = rmsToDb(rms);
  if (db <= METER_FLOOR_DB) return 0;
  const r = (db - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB);
  return Math.max(0, Math.min(METER_SEGMENTS, Math.round(r * METER_SEGMENTS)));
}

/** 目安線の位置（左から何セグメント目の後ろか） */
export const VOICE_SEGMENT = Math.round(((VOICE_DB - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB)) * METER_SEGMENTS);

/**
 * 無音の継続を追う。`since` は無音が始まった時刻（音があれば null）。
 * 戻り値の silent は SILENCE_MS 以上続いたか。
 */
export function trackSilence(prev: { since: number | null }, rms: number, now: number): { since: number | null; silent: boolean } {
  if (rmsToDb(rms) >= SILENCE_DB) return { since: null, silent: false };
  const since = prev.since ?? now;
  return { since, silent: now - since >= SILENCE_MS };
}
