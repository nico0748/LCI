/** 編集距離（Levenshtein）。タイトルの近似重複検出にだけ使うので O(n·m) で十分 */
export function levenshtein(a: string, b: string): number {
  const s = [...a];
  const t = [...b];
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = new Array<number>(t.length + 1);
  let cur = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[t.length] ?? 0;
}

/** 全角/半角・大文字小文字・空白・記号の差を無視して比較するための正規化 */
export function normalizeTitle(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 0〜1 の類似度。1 が同一。閾値 0.85 以上を近似重複として警告する */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  const n = Math.max([...x].length, [...y].length);
  if (n === 0) return 1;
  return 1 - levenshtein(x, y) / n;
}
