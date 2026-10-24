import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const [n, k] = data as [number, number];
const a = data.slice(2, 2 + n);
// ここに実装する
console.log(-1);
