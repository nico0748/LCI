import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const q = data[1]!;
// Float64Array の sort は数値順（Array#sort は比較関数なしだと文字列順になる）
const ts = Float64Array.from(data.slice(2, 2 + n)).sort();

/** ts[i] >= x（strict なら ts[i] > x）を満たす最初の位置 = それより前の要素数 */
function firstAtLeast(x: number, strict: boolean): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const v = ts[mid]!;
    if (strict ? v > x : v >= x) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

const out: number[] = [];
for (let j = 0; j < q; j++) {
  const l = data[2 + n + 2 * j]!;
  const r = data[3 + n + 2 * j]!;
  out.push(firstAtLeast(r, true) - firstAtLeast(l, false));
}
process.stdout.write(out.join("\n") + "\n");
