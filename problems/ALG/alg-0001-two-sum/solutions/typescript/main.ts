import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const k = data[1]!;
const seen = new Map<number, number>();
let ans = "-1";
for (let j = 0; j < n; j++) {
  const x = data[2 + j]!;
  const i = seen.get(k - x);
  if (i !== undefined) {
    ans = `${i + 1} ${j + 1}`;
    break;
  }
  if (!seen.has(x)) seen.set(x, j);
}
console.log(ans);
