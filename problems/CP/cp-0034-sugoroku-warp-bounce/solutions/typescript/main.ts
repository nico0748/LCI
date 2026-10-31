import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "").map(Number);
let p = 0;
const N = tok[p++];
const K = tok[p++];
const dice = tok.slice(p, p + K);
p += K;
const M = tok[p++];
const warp = new Array<number>(N + 1).fill(-1); // 入口 → 出口（-1 はワープなし）
for (let j = 0; j < M; j++) {
  const s = tok[p++];
  warp[s] = tok[p++];
}

function play(): string {
  let pos = 0;
  for (let t = 0; t < K; t++) {
    pos += dice[t];
    if (pos > N) pos = N - (pos - N); // 越えた分だけ戻る
    if (pos === N) return `GOAL ${t + 1}`; // ちょうど止まったときだけゴール。残りの出目は使わない
    if (warp[pos] >= 0) pos = warp[pos]; // 1 回だけ（出口のワープは使わない）
  }
  return String(pos);
}

process.stdout.write(play() + "\n");
