import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const k = Number(tok[1]);
const w = new Float64Array(n);
let lo = 0;
let hi = 0;
for (let i = 0; i < n; i++) {
  w[i] = Number(tok[2 + i]);
  if (w[i] > lo) lo = w[i];
  hi += w[i];
}
// Σw ≤ 2×10^14 < 2^53 なので Number（double）で正確に扱える

/** 棚幅 cap で、左から詰めて K 段以内に収まるか（cap ≥ max(w) で呼ぶ） */
function fits(cap: number): boolean {
  let count = 1;
  let cur = 0;
  for (let i = 0; i < n; i++) {
    cur += w[i];
    if (cur > cap) {
      count++;
      if (count > k) return false;
      cur = w[i];
    }
  }
  return true;
}

// 答えは [max(w), Σw] の中。「収まる最小の幅」を二分探索する
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  if (fits(mid)) hi = mid;
  else lo = mid + 1;
}
process.stdout.write(`${lo}\n`);
