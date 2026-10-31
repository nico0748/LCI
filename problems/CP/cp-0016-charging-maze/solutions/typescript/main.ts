import { readFileSync } from "node:fs";

const lines = readFileSync(0, "utf8").split("\n");
const [h, w, b] = lines[0]!.trim().split(/\s+/).map(Number) as [number, number, number];
const g = lines.slice(1, 1 + h).map((s) => s.slice(0, w)).join(""); // マス v = r * w + c
const start = g.indexOf("S");
const goal = g.indexOf("G");
const k = b + 1;
// 状態 = (マス, 残り) を 1 つの整数 v * k + e にする。マスだけで訪問済みにすると充電の遠回りを捨ててしまう
const dist = new Int32Array(h * w * k).fill(-1);
const queue = new Int32Array(h * w * k); // 各状態は高々 1 回しか積まれない
let head = 0;
let tail = 0;
dist[start * k + b] = 0;
queue[tail++] = start * k + b;
let ans = -1;
bfs: while (head < tail) {
  const s = queue[head++]!;
  const v = Math.floor(s / k);
  const e = s % k;
  if (e === 0) continue; // 電池切れ: ここからは動けない
  const d = dist[s]! + 1;
  const r = Math.floor(v / w);
  const c = v % w;
  const nbs = [r > 0 ? v - w : -1, r + 1 < h ? v + w : -1, c > 0 ? v - 1 : -1, c + 1 < w ? v + 1 : -1];
  for (const u of nbs) {
    if (u < 0) continue;
    const ch = g[u];
    if (ch === "#") continue;
    if (u === goal) {
      ans = d; // 残り 0 で着いてもよい。BFS なので最初に着いた手数が最短
      break bfs;
    }
    const t = u * k + (ch === "C" ? b : e - 1);
    if (dist[t] === -1) {
      dist[t] = d;
      queue[tail++] = t;
    }
  }
}
process.stdout.write(`${ans}\n`);
