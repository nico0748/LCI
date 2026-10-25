import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
let p = 0;
const next = (): number => Number(tok[p++]);
const n = next();
const m = next();
const price: number[] = [];
const mask: number[] = [];
for (let i = 0; i < n; i++) {
  price.push(next());
  const k = next();
  let b = 0;
  for (let j = 0; j < k; j++) b |= 1 << (next() - 1); // 栄養 a をビット a-1 に
  mask.push(b);
}
const full = (1 << m) - 1;
const size = 1 << n;
const cover = new Int32Array(size); // 集合 s の栄養の OR
const cost = new Float64Array(size); // 集合 s の合計（最大 1.5×10^10。2^53 未満なので Number で正確）
let best = -1;
let ways = 0;
for (let s = 1; s < size; s++) {
  const low = s & -s; // 最下位の 1 ビット = 番号が最小の料理
  const i = 31 - Math.clz32(low);
  cover[s] = cover[s ^ low]! | mask[i]!;
  cost[s] = cost[s ^ low]! + price[i]!;
  if (cover[s] === full) {
    if (best === -1 || cost[s]! < best) {
      best = cost[s]!;
      ways = 1;
    } else if (cost[s] === best) {
      ways++;
    }
  }
}
process.stdout.write(best === -1 ? "-1\n" : `${best} ${ways}\n`);
