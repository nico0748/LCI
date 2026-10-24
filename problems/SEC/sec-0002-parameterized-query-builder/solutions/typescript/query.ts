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

const COLUMNS = "id, author_id, title, status, created_at, like_count";
const STATUSES = new Set(["draft", "published", "archived"]);
// 識別子はプレースホルダにできないので、許可リストの対応表から SQL 断片を選ぶ
const SORTS: Record<string, string> = {
  created_at: "created_at ASC, id DESC",
  "-created_at": "created_at DESC, id DESC",
  like_count: "like_count ASC, id DESC",
  "-like_count": "like_count DESC, id DESC",
  id: "id ASC",
  "-id": "id DESC",
};
const MAX_IDS = 100;

function int(name: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v)) throw new Error(`${name} は整数`);
  return v;
}

// \ を最初にエスケープしないと、後で足した \% の \ が二重に解釈される
const likeLiteral = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

// 値は必ず params に入れ、SQL 文字列には固定の断片しか入れない
export function buildPostSearch(filters: Filters, sort = "-created_at", limit = 20): Query {
  const where: string[] = [];
  const params: (string | number)[] = [];
  for (const [key, v] of Object.entries(filters as Record<string, unknown>)) {
    switch (key) {
      case "author_id":
        where.push("author_id = ?");
        params.push(int(key, v));
        break;
      case "status":
        if (typeof v !== "string" || !STATUSES.has(v)) throw new Error("status が不正");
        where.push("status = ?");
        params.push(v);
        break;
      case "title_contains":
        if (typeof v !== "string") throw new Error("title_contains は文字列");
        where.push("title LIKE ? ESCAPE '\\'");
        params.push(`%${likeLiteral(v)}%`);
        break;
      case "created_from":
        where.push("created_at >= ?");
        params.push(int(key, v));
        break;
      case "created_to":
        where.push("created_at <= ?");
        params.push(int(key, v));
        break;
      case "ids": {
        if (!Array.isArray(v) || v.length > MAX_IDS) throw new Error(`ids は ${MAX_IDS} 件以下の配列`);
        const ids = v.map((x) => int(key, x));
        if (ids.length === 0) where.push("1 = 0");
        else {
          where.push(`id IN (${ids.map(() => "?").join(", ")})`);
          params.push(...ids);
        }
        break;
      }
      default:
        throw new Error(`未知の条件: ${JSON.stringify(key)}`);
    }
  }
  const order = Object.hasOwn(SORTS, sort) ? SORTS[sort] : undefined;
  if (order === undefined) throw new Error("sort が不正");
  if (int("limit", limit) < 1 || limit > 100) throw new Error("limit は 1〜100");
  let sql = `SELECT ${COLUMNS} FROM posts`;
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += ` ORDER BY ${order} LIMIT ?`;
  params.push(limit);
  return { sql, params };
}
