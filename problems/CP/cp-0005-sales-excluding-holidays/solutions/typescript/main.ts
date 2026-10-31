import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const q = Number(tok[1]);
// 累積和を 2 本。合計は最大 2×10^14 < 2^53 なので Float64Array で正確に持てる
const ps = new Float64Array(n + 1);
const pc = new Int32Array(n + 1);
for (let i = 0; i < n; i++) {
  const a = Number(tok[2 + i]);
  // 休業日（-1）は足さない。売上 0 円の営業日は日数に数える
  ps[i + 1] = ps[i] + (a >= 0 ? a : 0);
  pc[i + 1] = pc[i] + (a >= 0 ? 1 : 0);
}
const out: string[] = new Array(q);
let p = 2 + n;
for (let j = 0; j < q; j++) {
  const l = Number(tok[p]);
  const r = Number(tok[p + 1]);
  p += 2;
  // 両端を含む L..R は「R までの和 − (L−1) までの和」
  out[j] = `${ps[r] - ps[l - 1]} ${pc[r] - pc[l - 1]}`;
}
process.stdout.write(out.join("\n") + "\n");
