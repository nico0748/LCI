import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const [n, k, t] = data as [number, number, number];
const a = data.slice(3, 3 + n);
// ここに実装する
console.log("TODO");
