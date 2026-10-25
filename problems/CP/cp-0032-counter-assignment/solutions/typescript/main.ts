import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "").map(Number);
const N = tok[0];
const M = tok[1];
// 時刻は最大で約 2×10^13 だが 2^53 未満なので Number のままで正確
const free = new Array<number>(M).fill(0); // 窓口 k が空く時刻（その時刻ちょうどから空き）
const out: string[] = [];
for (let i = 0; i < N; i++) {
  const a = tok[2 + 2 * i];
  const d = tok[3 + 2 * i];
  let s = a;
  let earliest = Infinity;
  for (let k = 0; k < M; k++) if (free[k] < earliest) earliest = free[k];
  if (earliest > s) s = earliest; // 空きが無ければ、最も早く空く時刻まで待つ
  let k = 0;
  while (free[k] > s) k++; // 時刻 s に空いている窓口のうち番号最小
  free[k] = s + d;
  out.push(`${k + 1} ${s - a}`);
}
process.stdout.write(out.join("\n") + "\n");
