export interface Post {
  id: number;
  created_at: number;
  title: string;
}

export interface Page {
  items: Post[];
  nextCursor: string | null;
}

// 新しい順に limit 件と nextCursor を返す
export function paginate(posts: Post[], limit: number, cursor?: string | null): Page {
  throw new Error("not implemented");
}
