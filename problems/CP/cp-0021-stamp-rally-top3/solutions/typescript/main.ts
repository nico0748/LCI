import { readFileSync } from "node:fs";

const t = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
let k = 0;
const n = Number(t[k++]);
const m = Number(t[k++]);
const points: number[] = [];
for (let j = 0; j < m; j++) points.push(Number(t[k++]));

const score = new Map<string, number>();
const seen = new Set<string>(); // "名前 地点" を 1 回だけ数える
for (let i = 0; i < n; i++) {
  const name = t[k++];
  const c = Number(t[k++]);
  const key = `${name} ${c}`;
  if (seen.has(key)) continue;
  seen.add(key);
  score.set(name, (score.get(name) ?? 0) + points[c - 1]);
}

// 得点の降順、同点は名前の昇順（localeCompare はロケール依存なので < で比べる）
const rows = [...score.entries()];
rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
process.stdout.write(rows.slice(0, 3).map(([name, s]) => `${name} ${s}\n`).join(""));
