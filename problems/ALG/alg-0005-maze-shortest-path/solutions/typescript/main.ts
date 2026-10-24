import { readFileSync } from "node:fs";

const tokens = readFileSync(0, "utf8").split(/\s+/).filter(Boolean);
const h = Number(tokens[0]);
const w = Number(tokens[1]);
const grid = tokens.slice(2, 2 + h).join("");
const start = grid.indexOf("S");
const goal = grid.indexOf("G");
const dist = new Int32Array(h * w).fill(-1);
// Array#shift は O(n) なので、配列 + 先頭インデックスでキューにする
const queue = new Int32Array(h * w);
let head = 0;
let tail = 0;
dist[start] = 0;
queue[tail++] = start;
while (head < tail) {
  const cur = queue[head++]!;
  if (cur === goal) break;
  const r = Math.floor(cur / w);
  const c = cur % w;
  const d = dist[cur]! + 1;
  const next: number[] = [];
  if (r > 0) next.push(cur - w);
  if (r < h - 1) next.push(cur + w);
  if (c > 0) next.push(cur - 1);
  if (c < w - 1) next.push(cur + 1);
  for (const nxt of next) {
    if (dist[nxt] === -1 && grid[nxt] !== "#") {
      dist[nxt] = d;
      queue[tail++] = nxt;
    }
  }
}
console.log(String(dist[goal]));
