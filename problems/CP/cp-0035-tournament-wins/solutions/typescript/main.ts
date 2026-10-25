import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((t) => t !== "");
const K = Number(tok[0]);
const N = 1 << K;
const s = new Int32Array(N + 1);
for (let i = 1; i <= N; i++) s[i] = Number(tok[i]);
let line = new Int32Array(N); // 今の回戦に残っている選手番号（表の左から）
for (let i = 0; i < N; i++) line[i] = Number(tok[1 + N + i]);
const wins = new Int32Array(N + 1);
let len = N;
while (len > 1) {
  const next = new Int32Array(len >> 1);
  for (let i = 0; i < len; i += 2) {
    const a = line[i];
    const b = line[i + 1];
    // 強さが大きい方、同じなら番号が小さい方（表の左右ではない）
    const w = s[a] > s[b] || (s[a] === s[b] && a < b) ? a : b;
    wins[w]++;
    next[i >> 1] = w;
  }
  line = next;
  len >>= 1;
}
process.stdout.write(`${line[0]}\n${Array.from(wins.subarray(1)).join(" ")}\n`);
