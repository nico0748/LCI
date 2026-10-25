import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const q = Number(tok[0]);
const lo = new Int32Array(q);
const hi = new Int32Array(q);
let n = 1;
for (let i = 0; i < q; i++) {
  lo[i] = Number(tok[1 + 2 * i]);
  hi[i] = Number(tok[2 + 2 * i]);
  if (hi[i]! > n) n = hi[i]!;
}
// エラトステネスの篩（0 と 1 は素数でない）
const isP = new Uint8Array(n + 1).fill(1);
isP[0] = 0;
isP[1] = 0;
for (let i = 2; i * i <= n; i++) if (isP[i]) for (let j = i * i; j <= n; j += i) isP[j] = 0;
// pre[x] = 1..x の素数の個数。[L, R] の個数は pre[R] - pre[L-1]
const pre = new Int32Array(n + 1);
for (let x = 1; x <= n; x++) pre[x] = pre[x - 1]! + isP[x]!;
const out: number[] = new Array(q);
for (let i = 0; i < q; i++) out[i] = pre[hi[i]!]! - pre[lo[i]! - 1]!;
process.stdout.write(out.join("\n") + "\n");
