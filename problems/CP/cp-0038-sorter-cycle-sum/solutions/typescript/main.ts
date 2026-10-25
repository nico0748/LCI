import { readFileSync } from "node:fs";

const MOD = 1_000_000_007;
const tok = readFileSync(0, "utf8").split(/\s+/).filter((t) => t !== "");
const N = Number(tok[0]);
const K = BigInt(tok[1]); // 10^18 は 2^53 を超えるので Number では正確に読めない
const T = new Int32Array(N + 1);
const A = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) T[i] = Number(tok[1 + i]);
for (let i = 1; i <= N; i++) A[i] = Number(tok[1 + N + i]);

// 仕分け機 1 から、各仕分け機に初めて着いたのが何回目の移動の前かを記録する
const first = new Int32Array(N + 1).fill(-1);
const order: number[] = [];
let x = 1;
while (first[x] < 0) {
  first[x] = order.length;
  order.push(x);
  x = T[x];
}
const mu = first[x]; // 尾の長さ
const lam = order.length - mu; // 周期の長さ
const pre = new Float64Array(order.length + 1); // 合計は最大 2×10^14 で 2^53 未満なので正確
for (let j = 0; j < order.length; j++) pre[j + 1] = pre[j] + A[order[j]];

if (K <= BigInt(order.length)) {
  const k = Number(K);
  process.stdout.write(`${T[order[k - 1]]} ${pre[k] % MOD}\n`);
} else {
  const d = K - BigInt(mu);
  const q = d / BigInt(lam);
  const r = Number(d % BigInt(lam));
  const cyc = pre[mu + lam] - pre[mu];
  // (q mod p) × (周期の和 mod p) は約 10^18 になるので BigInt で掛ける
  const m = BigInt(MOD);
  const total = (BigInt(pre[mu + r]) + (q % m) * BigInt(cyc % MOD)) % m;
  process.stdout.write(`${order[mu + r]} ${total}\n`);
}
