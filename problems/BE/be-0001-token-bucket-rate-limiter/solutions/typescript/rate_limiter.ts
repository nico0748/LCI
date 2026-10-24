// token bucket 方式のレートリミッタ。
// キーごとに { tokens, last } だけを持ち、アクセス時に経過時間分をまとめて補充する（遅延補充）。
interface Bucket {
  tokens: number;
  last: number;
}

const EPS = 1e-9;

export class RateLimiter {
  private readonly capacity: number;
  private readonly refill: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(capacity: number, refillPerSec: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("capacity は正の整数");
    if (!(refillPerSec > 0)) throw new Error("refillPerSec は正の数");
    this.capacity = capacity;
    this.refill = refillPerSec;
  }

  private bucket(key: string, now: number): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, last: now };
      this.buckets.set(key, b);
      return b;
    }
    // 時刻の巻き戻りは経過 0 とみなす。last を戻すと次回に二重に補充されるので max で保持
    const elapsed = Math.max(0, now - b.last);
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refill);
    b.last = Math.max(b.last, now);
    return b;
  }

  allow(key: string, now: number): boolean {
    const b = this.bucket(key, now);
    if (b.tokens >= 1 - EPS) {
      b.tokens -= 1;
      return true;
    }
    return false;
  }

  retryAfter(key: string, now: number): number {
    const b = this.bucket(key, now);
    const missing = 1 - b.tokens;
    return missing <= EPS ? 0 : missing / this.refill;
  }
}
