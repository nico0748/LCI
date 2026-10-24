export interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

export class LikeApi {
  private readonly clock: () => number;

  constructor(clock: () => number = () => performance.now() / 1000) {
    this.clock = clock;
  }

  like(userId: string, postId: string, idempotencyKey?: string): ApiResponse {
    throw new Error("not implemented");
  }

  unlike(userId: string, postId: string, idempotencyKey?: string): ApiResponse {
    throw new Error("not implemented");
  }

  count(postId: string): number {
    throw new Error("not implemented");
  }
}
