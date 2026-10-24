// token bucket 方式のレートリミッタ
export class RateLimiter {
  constructor(capacity: number, refillPerSec: number) {
    throw new Error("not implemented");
  }

  allow(key: string, now: number): boolean {
    throw new Error("not implemented");
  }

  retryAfter(key: string, now: number): number {
    throw new Error("not implemented");
  }
}
