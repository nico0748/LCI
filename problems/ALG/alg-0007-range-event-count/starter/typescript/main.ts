import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const q = data[1]!;
const ts = data.slice(2, 2 + n);
const queries: [number, number][] = [];
for (let j = 0; j < q; j++) queries.push([data[2 + n + 2 * j]!, data[3 + n + 2 * j]!]);
// ここに実装する
console.log("TODO");
