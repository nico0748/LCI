export interface Filters {
  author_id?: number;
  status?: string;
  title_contains?: string;
  created_from?: number;
  created_to?: number;
  ids?: number[];
}

export interface Query {
  sql: string;
  params: (string | number)[];
}

// 検索条件から { sql, params } を作る
export function buildPostSearch(filters: Filters, sort = "-created_at", limit = 20): Query {
  throw new Error("not implemented");
}
