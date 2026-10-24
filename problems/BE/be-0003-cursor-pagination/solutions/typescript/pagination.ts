export interface Post {
  id: number;
  created_at: number;
  title: string;
}

export interface Page {
  items: Post[];
  nextCursor: string | null;
}

const MAX_LIMIT = 100;

function encode(createdAt: number, id: number): string {
  return Buffer.from(JSON.stringify({ c: createdAt, i: id })).toString("base64url");
}

function decode(cursor: string): [number, number] {
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("invalid_cursor");
  }
  if (!data || typeof data !== "object") throw new Error("invalid_cursor");
  const { c, i } = data as { c?: unknown; i?: unknown };
  if (!Number.isInteger(c) || !Number.isInteger(i)) throw new Error("invalid_cursor");
  return [c as number, i as number];
}

// (created_at, id) の辞書式比較。a が b より「新しい」なら正
function cmp(a: [number, number], b: [number, number]): number {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

// 新しい順（created_at 降順、同時刻は id 降順）に limit 件と nextCursor を返す。
// カーソルは最後に返した投稿の (created_at, id)。値で比較するので新着の挿入でページがずれない。
export function paginate(posts: Post[], limit: number, cursor?: string | null): Page {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit は 1 以上");
  const n = Math.min(limit, MAX_LIMIT);
  let ordered = [...posts].sort((a, b) => cmp([b.created_at, b.id], [a.created_at, a.id]));
  if (cursor !== undefined && cursor !== null) {
    const boundary = decode(cursor);
    ordered = ordered.filter((p) => cmp([p.created_at, p.id], boundary) < 0);
  }
  // limit + 1 件見て次があるかを判定する
  const window = ordered.slice(0, n + 1);
  const items = window.slice(0, n);
  const last = items[items.length - 1];
  const nextCursor = window.length > n && last ? encode(last.created_at, last.id) : null;
  return { items, nextCursor };
}
