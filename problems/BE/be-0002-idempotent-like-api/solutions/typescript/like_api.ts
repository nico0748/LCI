// いいね API（インメモリ）。
// - 操作自体の冪等性: (user, post) の集合で持つので二重いいねで件数が増えない
// - 応答の再現: Idempotency-Key ごとに最初の応答を保存し、再送には同じ応答を返す
export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

type Op = "like" | "unlike";

interface SavedResponse {
  fingerprint: string;
  status: number;
  body: Record<string, unknown>;
  expiresAt: number;
}

const KEY_TTL_SEC = 24 * 60 * 60;

export class LikeApi {
  private readonly clock: () => number;
  private readonly likes = new Set<string>();
  private readonly counts = new Map<string, number>();
  // `${userId}\u0000${key}` → 保存した応答。キーはユーザーごとの名前空間
  private readonly keys = new Map<string, SavedResponse>();

  constructor(clock: () => number = () => performance.now() / 1000) {
    this.clock = clock;
  }

  like(userId: string, postId: string, idempotencyKey?: string): ApiResponse {
    return this.handle("like", userId, postId, idempotencyKey);
  }

  unlike(userId: string, postId: string, idempotencyKey?: string): ApiResponse {
    return this.handle("unlike", userId, postId, idempotencyKey);
  }

  count(postId: string): number {
    return this.counts.get(postId) ?? 0;
  }

  private handle(op: Op, userId: string, postId: string, key: string | undefined): ApiResponse {
    // 検証エラーは保存しない（直して同じキーで送り直せるように）
    if (!userId || !postId) return { status: 400, body: { error: "invalid_request" } };
    const now = this.clock();
    const fingerprint = JSON.stringify([op, postId]);
    const slot = key === undefined ? null : `${userId}\u0000${key}`;
    if (slot) {
      const saved = this.keys.get(slot);
      if (saved && saved.expiresAt > now) {
        if (saved.fingerprint !== fingerprint) return { status: 422, body: { error: "idempotency_key_reused" } };
        return { status: saved.status, body: structuredClone(saved.body) };
      }
    }
    const res = this.apply(op, userId, postId);
    if (slot) this.keys.set(slot, { fingerprint, status: res.status, body: structuredClone(res.body), expiresAt: now + KEY_TTL_SEC });
    return res;
  }

  private apply(op: Op, userId: string, postId: string): ApiResponse {
    const pair = `${userId}\u0000${postId}`;
    let status = 200;
    if (op === "like") {
      if (!this.likes.has(pair)) {
        this.likes.add(pair);
        this.counts.set(postId, this.count(postId) + 1);
        status = 201;
      }
    } else if (this.likes.delete(pair)) {
      this.counts.set(postId, Math.max(0, this.count(postId) - 1));
    }
    return { status, body: { post_id: postId, liked: op === "like", like_count: this.count(postId) } };
  }
}
