import { readFileSync } from "node:fs";

const tokens = readFileSync(0, "utf8").split(/\s+/).filter(Boolean);
const n = Number(tokens[0]);
const k = Number(tokens[1]);
const counts = new Map<string, number>();
for (let i = 2; i < 2 + n; i++) {
  const w = tokens[i]!;
  counts.set(w, (counts.get(w) ?? 0) + 1);
}
// localeCompare はロケール依存になりうるので、文字コード順で比べる
const entries = [...counts.entries()].sort((a, b) =>
  b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
);
const out: string[] = [];
for (const [w, c] of entries.slice(0, k)) out.push(`${w} ${c}\n`);
process.stdout.write(out.join(""));
