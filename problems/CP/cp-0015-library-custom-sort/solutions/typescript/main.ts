import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const g = Number(tok[0]);
const rank = new Map<string, number>();
for (let i = 0; i < g; i++) rank.set(tok[1 + i]!, i);
const n = Number(tok[1 + g]);
type Book = { title: string; genre: string; year: number; r: number };
const books: Book[] = [];
for (let i = 0, p = 2 + g; i < n; i++, p += 3) {
  const genre = tok[p + 1]!;
  books.push({ title: tok[p]!, genre, year: Number(tok[p + 2]), r: rank.get(genre) ?? g }); // 一覧に無いジャンルは順位 G
}
// 文字コード順の比較。localeCompare はロケールの辞書順（大文字小文字をほぼ無視）なので使わない
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
books.sort((a, b) => {
  if (a.r !== b.r) return a.r - b.r;
  if (a.r === g && a.genre !== b.genre) return cmpStr(a.genre, b.genre); // 一覧外どうしはジャンル名順
  if (a.year !== b.year) return b.year - a.year; // 年は数値で、新しい順
  return cmpStr(a.title, b.title);
});
process.stdout.write(books.map((b) => b.title).join("\n") + "\n");
