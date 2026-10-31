import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const q = Number(tok[1]);
// Int32Array の sort は数値順（普通の配列の sort() は比較関数が無いと文字列順になる）
const xs = new Int32Array(n);
for (let i = 0; i < n; i++) xs[i] = Number(tok[2 + i]);
xs.sort();

/** h 以上で最初の駅の位置（無ければ n）。lower_bound */
function lowerBound(h: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < h) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const out: number[] = new Array(q);
for (let j = 0; j < q; j++) {
  const h = Number(tok[2 + n + j]);
  const i = lowerBound(h);
  // 最寄りは xs[i]（h 以上）か xs[i−1]（h 未満）。i が 0 や n のときは片方だけ
  if (i === 0) out[j] = xs[0] - h;
  else if (i === n) out[j] = h - xs[n - 1];
  else out[j] = Math.min(xs[i] - h, h - xs[i - 1]);
}
process.stdout.write(out.join("\n") + "\n");
