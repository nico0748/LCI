import type { Event, EventOf } from "@lci/core";
import type { SessionClock } from "./clock.ts";

/**
 * イベントのバッチ送信キュー（要件書 01 §2.3 FR-C-38）。
 * - seq はブラウザ側で単調増加。サーバは seq で重複排除するので、再送しても壊れない。
 * - 1 秒ごと、または 50 件たまったらフラッシュ。
 * - 送信前に IndexedDB（PendingStorage）へ書き、ACK 後に消す。リロード時は未 ACK 分を先に再送する。
 * - pagehide では sendBeacon で残りを投げる（fetch は捨てられることがある）。
 */

/** Omit は union に分配されないので条件型で分配する（type ごとに必須フィールドが効く） */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type LogInput = DistributiveOmit<Event, "t" | "seq"> & { t?: number };
export type LogInputOf<T extends Event["type"]> = Omit<EventOf<T>, "t" | "seq"> & { t?: number };

export interface EventSink {
  /** 成功なら true。ネットワーク・5xx は false（再送対象）。4xx は true を返して捨ててよい（再送しても直らない） */
  send(sessionId: string, events: Event[]): Promise<boolean>;
  /** pagehide 用。同期的にキューに乗せられたら true */
  beacon?(sessionId: string, events: Event[]): boolean;
}

export interface PendingBatch {
  key: string;
  sessionId: string;
  events: Event[];
}

export interface PendingStorage {
  put(batch: PendingBatch): Promise<void>;
  delete(key: string): Promise<void>;
  list(sessionId: string): Promise<PendingBatch[]>;
}

export class MemoryPendingStorage implements PendingStorage {
  readonly map = new Map<string, PendingBatch>();
  async put(b: PendingBatch) {
    this.map.set(b.key, b);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async list(sessionId: string) {
    return [...this.map.values()].filter((b) => b.sessionId === sessionId);
  }
}

export interface EventLoggerOptions {
  sessionId: string;
  clock: SessionClock;
  sink: EventSink;
  storage?: PendingStorage;
  /** 最初の seq（復旧時は サーバの last_seq + 1） */
  startSeq?: number;
  flushIntervalMs?: number;
  maxBatch?: number;
  /** テスト用のタイマ差し替え */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  onError?: (err: unknown) => void;
}

export class EventLogger {
  private seq: number;
  private queue: Event[] = [];
  private inflight: Promise<void> | null = null;
  private timer: unknown = null;
  private stopped = false;
  private failures = 0;
  private readonly storage: PendingStorage;
  private readonly flushIntervalMs: number;
  private readonly maxBatch: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;
  /** 統計（ステータス行で見せる） */
  readonly stats = { logged: 0, acked: 0, pending: 0, failures: 0 };

  private readonly opts: EventLoggerOptions;

  // Node の --experimental-strip-types はパラメータプロパティを消せないので明示代入にする
  constructor(opts: EventLoggerOptions) {
    this.opts = opts;
    this.seq = (opts.startSeq ?? 1) - 1;
    this.storage = opts.storage ?? new MemoryPendingStorage();
    this.flushIntervalMs = opts.flushIntervalMs ?? 1000;
    this.maxBatch = opts.maxBatch ?? 50;
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  get sessionId() {
    return this.opts.sessionId;
  }
  get clock() {
    return this.opts.clock;
  }
  get lastSeq() {
    return this.seq;
  }

  /** seq を 1 つ予約する（snapshot のようにサーバ側で行を追記するイベント用） */
  nextSeq(): number {
    return ++this.seq;
  }

  /** イベントを積む。t 省略時は現在時刻 */
  log(input: LogInput): Event {
    const ev = { ...(input as object), t: input.t ?? this.opts.clock.now(), seq: this.nextSeq() } as unknown as Event;
    if (this.stopped) return ev;
    this.queue.push(ev);
    this.stats.logged++;
    this.stats.pending = this.queue.length;
    if (this.queue.length >= this.maxBatch) void this.flush();
    else this.schedule();
    return ev;
  }

  private schedule() {
    if (this.timer !== null || this.stopped) return;
    // 送信失敗が続いたら少し間隔を空ける（最大 8 秒）
    const backoff = Math.min(8000, this.flushIntervalMs * 2 ** Math.min(3, this.failures));
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, this.failures > 0 ? backoff : this.flushIntervalMs);
  }

  /** キューの先頭から 1 バッチ送る。進行中なら合流する */
  flush(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.queue.length === 0) return Promise.resolve();
    this.inflight = this.flushOnce().finally(() => {
      this.inflight = null;
      if (this.queue.length > 0) this.schedule();
    });
    return this.inflight;
  }

  private async flushOnce() {
    const events = this.queue.splice(0, this.maxBatch);
    const key = `${this.opts.sessionId}:${events[0]!.seq}`;
    try {
      await this.storage.put({ key, sessionId: this.opts.sessionId, events });
    } catch (e) {
      this.opts.onError?.(e);
    }
    let ok = false;
    try {
      ok = await this.opts.sink.send(this.opts.sessionId, events);
    } catch (e) {
      this.opts.onError?.(e);
    }
    if (ok) {
      this.failures = 0;
      this.stats.acked += events.length;
      try {
        await this.storage.delete(key);
      } catch (e) {
        this.opts.onError?.(e);
      }
    } else {
      // 順序を保つため先頭に戻す。IndexedDB には残っているのでリロードしても失わない
      this.failures++;
      this.stats.failures++;
      this.queue.unshift(...events);
    }
    this.stats.pending = this.queue.length;
  }

  /** すべて送り切るまで待つ（終了時）。送れないものは IndexedDB に残す */
  async drain(maxAttempts = 3): Promise<boolean> {
    for (let i = 0; i < maxAttempts && this.queue.length > 0; i++) {
      await this.flush();
    }
    return this.queue.length === 0;
  }

  /** pagehide: 残りを sendBeacon で投げる。IndexedDB にも書いておく */
  beaconRemaining(): void {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, this.queue.length);
    const key = `${this.opts.sessionId}:${events[0]!.seq}`;
    void this.storage.put({ key, sessionId: this.opts.sessionId, events }).catch(() => {});
    const sent = this.opts.sink.beacon?.(this.opts.sessionId, events) ?? false;
    if (!sent) this.queue.unshift(...events);
  }

  /** リロード後: 未 ACK のバッチを再送し、その中の最大 seq を返す（新しい seq はこれより大きくする） */
  async replayPending(): Promise<number> {
    let maxSeq = 0;
    let batches: PendingBatch[] = [];
    try {
      batches = await this.storage.list(this.opts.sessionId);
    } catch (e) {
      this.opts.onError?.(e);
      return 0;
    }
    for (const b of batches) {
      for (const e of b.events) maxSeq = Math.max(maxSeq, e.seq);
      let ok = false;
      try {
        ok = await this.opts.sink.send(b.sessionId, b.events);
      } catch (e) {
        this.opts.onError?.(e);
      }
      if (ok) await this.storage.delete(b.key).catch(() => {});
    }
    if (maxSeq > this.seq) this.seq = maxSeq;
    return maxSeq;
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  /** pagehide / visibilitychange を結線する。戻り値で解除 */
  installPageHooks(onVisibility?: (state: "visible" | "hidden") => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onPageHide = () => this.beaconRemaining();
    const onVis = () => {
      const state = document.visibilityState === "hidden" ? "hidden" : "visible";
      onVisibility?.(state);
      if (state === "hidden") void this.flush();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }
}

/** 本番用 Sink: POST /api/sessions/[id]/events */
export function fetchSink(baseUrl = ""): EventSink {
  return {
    async send(sessionId, events) {
      const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: events.length <= 20,
      });
      if (res.ok) return true;
      // 4xx は再送しても直らないので捨てる（ログには残す）
      return res.status >= 400 && res.status < 500;
    },
    beacon(sessionId, events) {
      if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
      const blob = new Blob([JSON.stringify({ events })], { type: "application/json" });
      return navigator.sendBeacon(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/events`, blob);
    },
  };
}
