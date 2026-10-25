import { readFileSync } from "node:fs";

const buf = readFileSync(0);
let pos = 0;
function nextInt(): number {
  while (buf[pos] < 48 || buf[pos] > 57) pos++;
  let x = 0;
  while (pos < buf.length && buf[pos] >= 48 && buf[pos] <= 57) x = x * 10 + buf[pos++] - 48;
  return x; // T ≤ 10^12 も 2^53 未満なので number で正確
}

const n = nextInt();
const m = nextInt();
const T = nextInt();
const eu = new Int32Array(m);
const ev = new Int32Array(m);
const ew = new Int32Array(m);
const deg = new Int32Array(n + 2);
for (let j = 0; j < m; j++) {
  eu[j] = nextInt();
  ev[j] = nextInt();
  ew[j] = nextInt();
  deg[eu[j]]++;
  deg[ev[j]]++;
}
// 隣接リストを CSR（拠点 v の辺は to[start[v] .. start[v+1]) ）で持つ
const start = new Int32Array(n + 2);
for (let v = 1; v <= n; v++) start[v + 1] = start[v] + deg[v];
const fill = start.slice();
const to = new Int32Array(2 * m);
const wt = new Int32Array(2 * m);
for (let j = 0; j < m; j++) {
  to[fill[eu[j]]] = ev[j];
  wt[fill[eu[j]]++] = ew[j];
  to[fill[ev[j]]] = eu[j];
  wt[fill[ev[j]]++] = ew[j];
}

// 二分ヒープ（TypeScript には標準のヒープが無いので自作）。キーは距離、値は拠点
const cap = 2 * m + 2;
const hk = new Float64Array(cap);
const hv = new Int32Array(cap);
let hs = 0;
function push(key: number, v: number): void {
  let i = hs++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (hk[p] <= key) break;
    hk[i] = hk[p];
    hv[i] = hv[p];
    i = p;
  }
  hk[i] = key;
  hv[i] = v;
}
let topKey = 0;
let topVal = 0;
function pop(): void {
  topKey = hk[0];
  topVal = hv[0];
  hs--;
  const key = hk[hs];
  const v = hv[hs];
  let i = 0;
  for (;;) {
    let c = 2 * i + 1;
    if (c >= hs) break;
    if (c + 1 < hs && hk[c + 1] < hk[c]) c++;
    if (hk[c] >= key) break;
    hk[i] = hk[c];
    hv[i] = hv[c];
    i = c;
  }
  hk[i] = key;
  hv[i] = v;
}

const dist = new Float64Array(n + 1).fill(Infinity);
dist[1] = 0;
push(0, 1);
while (hs > 0) {
  pop();
  const d = topKey;
  const u = topVal;
  if (d > dist[u]) continue; // 古い要素は捨てる
  for (let e = start[u]; e < start[u + 1]; e++) {
    const nd = d + wt[e];
    const v = to[e];
    if (nd < dist[v]) {
      dist[v] = nd;
      push(nd, v);
    }
  }
}
let within = 0;
for (let v = 1; v <= n; v++) if (dist[v] <= T) within++;
process.stdout.write(`${within}\n${dist[n] === Infinity ? -1 : dist[n]}\n`);
