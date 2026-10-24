import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const bookings: [number, number][] = [];
for (let i = 0; i < n; i++) bookings.push([data[1 + 2 * i]!, data[2 + 2 * i]!]);
// ここに実装する
console.log("TODO");
