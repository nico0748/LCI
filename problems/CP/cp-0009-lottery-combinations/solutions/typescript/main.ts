import { readFileSync } from "node:fs";

const P = 998244353;

/** a * b mod P。a, b < P < 2^30 の積は 2^53 を超えるので、b を上下 16bit に分けて掛ける（途中の値は 2^47 未満） */
function mul(a: number, b: number): number {
  return (((a * (b >>> 16)) % P) * 65536 + a * (b & 65535)) % P;
}

function power(a: number, e: number): number {
  let r = 1;
  while (e > 0) {
    if (e & 1) r = mul(r, a);
    a = mul(a, a);
    e = Math.floor(e / 2);
  }
  return r;
}

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const q = Number(tok[0]);
let m = 0;
for (let i = 0; i < q; i++) m = Math.max(m, Number(tok[1 + 2 * i]));
// 階乗と、その逆元（フェルマーの小定理: a^(P−2)）を n の最大値まで前計算する
const fact = new Float64Array(m + 1);
const inv = new Float64Array(m + 1);
fact[0] = 1;
for (let i = 1; i <= m; i++) fact[i] = mul(fact[i - 1], i);
inv[m] = power(fact[m], P - 2);
for (let i = m; i >= 1; i--) inv[i - 1] = mul(inv[i], i);
const out: number[] = new Array(q);
for (let i = 0; i < q; i++) {
  const n = Number(tok[1 + 2 * i]);
  const r = Number(tok[2 + 2 * i]);
  out[i] = r > n ? 0 : mul(mul(fact[n], inv[r]), inv[n - r]);
}
process.stdout.write(out.join("\n") + "\n");
