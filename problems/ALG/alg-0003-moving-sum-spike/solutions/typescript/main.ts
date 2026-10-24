import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const k = data[1]!;
const t = data[2]!;
const a = data.slice(3, 3 + n);
// 合計は最大 2×10^14。Number は 2^53 まで整数を正確に表せるので足りる（C/Go なら int64 が要る）
let s = 0;
for (let i = 0; i < k; i++) s += a[i]!;
let first = -1;
let count = 0;
for (let i = k; i <= n; i++) {
  if (i > k) s += a[i - 1]! - a[i - 1 - k]!;
  if (s > t) {
    count++;
    if (first < 0) first = i;
  }
}
console.log(`${first} ${count}`);
