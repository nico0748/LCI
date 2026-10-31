import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8");
let pos = 0;
function nextInt(): number {
  while (data.charCodeAt(pos) < 48) pos++; // 空白・改行を飛ばす（入力は非負整数だけ）
  let x = 0;
  for (let c = data.charCodeAt(pos); c >= 48 && c <= 57; c = data.charCodeAt(++pos)) x = x * 10 + (c - 48);
  return x;
}

const N = nextInt();
const M = nextInt();
const us = new Int32Array(M);
const vs = new Int32Array(M);
const indeg = new Int32Array(N + 1);
const start = new Int32Array(N + 2); // CSR: u の出辺は adj[start[u] .. start[u+1])
for (let i = 0; i < M; i++) {
  us[i] = nextInt();
  vs[i] = nextInt();
  start[us[i] + 1]++;
  indeg[vs[i]]++; // 重複した辺もそのまま数える
}
for (let u = 1; u <= N + 1; u++) start[u] += start[u - 1];
const fill = start.slice();
const adj = new Int32Array(M);
for (let i = 0; i < M; i++) adj[fill[us[i]]++] = vs[i];

// 段ごとの Kahn 法。queue[lo..hi) が今の学期の科目（再帰は使わない）
const queue = new Int32Array(N);
let tail = 0;
for (let v = 1; v <= N; v++) if (indeg[v] === 0) queue[tail++] = v;
const counts: number[] = [];
let lo = 0;
while (lo < tail) {
  const hi = tail;
  counts.push(hi - lo);
  for (; lo < hi; lo++) {
    const u = queue[lo];
    for (let e = start[u]; e < start[u + 1]; e++) {
      const v = adj[e];
      if (--indeg[v] === 0) queue[tail++] = v;
    }
  }
}
process.stdout.write(tail < N ? "-1\n" : `${counts.length}\n${counts.join(" ")}\n`);
