import { readFileSync } from "node:fs";

const t = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "").map(Number);
let k = 0;
const n = t[k++];
const m = t[k++];
const xs: number[] = [];
const ys: number[] = [];
for (let i = 0; i <= n; i++) {
  xs.push(t[k++]);
  ys.push(t[k++]);
}
const need: number[] = new Array(n + 1).fill(0); // need[b]: b より先に訪れる地点の集合（ビット）
for (let j = 0; j < m; j++) {
  const a = t[k++];
  const b = t[k++];
  need[b] |= 1 << a;
}
const d: number[][] = [];
for (let i = 0; i <= n; i++) {
  d.push([]);
  for (let j = 0; j <= n; j++) d[i].push(Math.sqrt((xs[i] - xs[j]) ** 2 + (ys[i] - ys[j]) ** 2));
}

let best = Infinity;
// 使用済みの集合 mask（ビット 0 は営業所）を持って、条件を満たす地点だけを次に置く再帰で順列を列挙する
function dfs(last: number, mask: number, placed: number, acc: number): void {
  if (placed === n) {
    const total = acc + d[last][0];
    if (total < best) best = total;
    return;
  }
  for (let v = 1; v <= n; v++) {
    if (mask & (1 << v)) continue;
    if (need[v] & ~mask) continue; // v より先に訪れるべき地点が残っている
    dfs(v, mask | (1 << v), placed + 1, acc + d[last][v]);
  }
}
dfs(0, 1, 0, 0);
process.stdout.write(best.toFixed(10) + "\n");
