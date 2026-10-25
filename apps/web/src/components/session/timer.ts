/**
 * 面接タイマーの表示（03 §3.3、X4）。純関数（session-helpers.test.ts）。
 * - 残り 5 分より前は「残り 19 分」の分単位（切り上げ）。秒を刻まない
 * - 残り 5 分からは「残り 4:59」の秒表示に切り替え、色は --warning（呼び出し側）。経過表示を選んでいても残りに戻す
 * - 経過表示は「経過 12 分」（切り捨て）。クリックで切り替え、設定は保存する
 */

export const WARN_MS = 5 * 60_000;
export const LAST_MINUTE_MS = 60_000;
export type TimerMode = "remaining" | "elapsed";
export const TIMER_MODE_KEY = "lci-timer-mode";

export type TimerView = {
  label: "残り" | "経過";
  value: string;
  /** 残り 5 分以下（--warning ＋左 3px の縦線） */
  warn: boolean;
  /** 読み上げ用（role="timer" の aria-label） */
  spoken: string;
};

/** mm:ss（秒は切り上げ。0 未満は 0:00） */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function timerView(remainingMs: number, limitMs: number, mode: TimerMode): TimerView {
  const rem = Math.max(0, remainingMs);
  if (rem <= WARN_MS) {
    const s = Math.ceil(rem / 1000);
    return { label: "残り", value: formatClock(rem), warn: true, spoken: `残り ${Math.floor(s / 60)} 分 ${s % 60} 秒` };
  }
  if (mode === "elapsed") {
    const m = Math.floor(Math.max(0, limitMs - rem) / 60_000);
    return { label: "経過", value: `${m} 分`, warn: false, spoken: `経過 ${m} 分` };
  }
  const m = Math.ceil(rem / 60_000);
  return { label: "残り", value: `${m} 分`, warn: false, spoken: `残り ${m} 分` };
}

/** 残り 5 分・1 分を跨いだときだけ 1 回読み上げる文（それ以外は null） */
export function timerAnnouncement(prevRemainingMs: number, remainingMs: number): string | null {
  if (prevRemainingMs > WARN_MS && remainingMs <= WARN_MS && remainingMs > LAST_MINUTE_MS) return "残り 5 分です";
  if (prevRemainingMs > LAST_MINUTE_MS && remainingMs <= LAST_MINUTE_MS && remainingMs > 0) return "残り 1 分です";
  return null;
}

/** 終了確認ダイアログの「残り 7 分 12 秒あります。」 */
export function remainingSentence(remainingMs: number): string | null {
  const s = Math.max(0, Math.ceil(remainingMs / 1000));
  if (s <= 0) return null;
  const m = Math.floor(s / 60);
  return m > 0 ? `残り ${m} 分 ${s % 60} 秒あります。` : `残り ${s} 秒あります。`;
}

export function parseTimerMode(raw: string | null | undefined): TimerMode {
  return raw === "elapsed" ? "elapsed" : "remaining";
}
