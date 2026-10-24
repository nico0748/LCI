/**
 * セッション時計（要件書 01 §2.4 FR-C-40）。
 * すべてのイベントは performance.now() 基準の単調増加ミリ秒 t（セッション開始 = 0）を持つ。
 * 壁時計は NTP 補正やスリープで跳ぶので、セッションメタの started_at_wall にだけ使う。
 */
export interface SessionClock {
  /** performance.now() 基準の原点 */
  readonly origin: number;
  /** 現在のセッション時刻 t（ms、整数に丸める） */
  now(): number;
  /** DOMHighResTimeStamp（event.timeStamp など performance.now と同じ時間軸）を t に変換 */
  fromTimeStamp(ts: number): number;
}

export interface ClockOptions {
  /** テスト用: performance.now の代替 */
  nowFn?: () => number;
  /** 原点を明示する（クラッシュ復旧で「開始からの経過」を引き継ぐとき） */
  origin?: number;
}

export function createClock(opts: ClockOptions = {}): SessionClock {
  const nowFn = opts.nowFn ?? (() => performance.now());
  const origin = opts.origin ?? nowFn();
  return {
    origin,
    now: () => Math.max(0, Math.round(nowFn() - origin)),
    fromTimeStamp: (ts) => Math.max(0, Math.round(ts - origin)),
  };
}

/**
 * リロード後（クラッシュ復旧）に使う原点。
 * 本来の原点は失われているので、壁時計の差分で「開始からの経過」を近似する。
 * 精度は秒オーダーだが、t が 0 に戻って既存イベントと時系列が壊れるよりはよい。
 */
export function recoveredOrigin(startedAtWall: string, nowFn: () => number = () => performance.now(), wallNow: number = Date.now()): number {
  const elapsed = Math.max(0, wallNow - new Date(startedAtWall).getTime());
  return nowFn() - elapsed;
}
