export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  hasNext: boolean;
}

/**
 * 請求明細を 1 始まりのページに分ける。
 * - totalPages: 全明細を perPage 件ずつ表示するのに必要なページ数。明細が 0 件でも 1。
 * - page が 1 未満、または totalPages より大きい場合は RangeError。
 * - items: そのページに表示する明細（最大 perPage 件）。
 * - hasNext: 次のページがあるか。
 */
export function paginate<T>(items: T[], page: number, perPage = 20): Page<T> {
  const totalPages = Math.floor(items.length / perPage);
  const start = page * perPage;
  const end = start + perPage - 1;
  return {
    items: items.slice(start, end),
    page,
    totalPages,
    hasNext: page <= totalPages,
  };
}

/** 請求日 billed_on（YYYY-MM-DD）が start 以上 end 以下（両端を含む）の明細を、元の順番のまま返す。 */
export function itemsInPeriod<T extends { billed_on: string }>(items: T[], start: string, end: string): T[] {
  return items.filter((i) => start < i.billed_on && i.billed_on < end);
}
