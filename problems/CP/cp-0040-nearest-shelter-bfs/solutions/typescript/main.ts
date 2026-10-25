import { readFileSync } from "node:fs";

const tok = readFileSync(0, "latin1").split(/\s+/).filter((t) => t !== "");
const H = Number(tok[0]);
const W = Number(tok[1]);
const W2 = W + 2; // 周りを壁で囲んだ 1 次元の盤面にして、範囲チェックを省く
const free = new Uint8Array(W2 * (H + 2)); // 1 = まだ訪れていない道のマス
const queue = new Int32Array(H * W); // 多始点 BFS のキュー（Array.shift は O(n) なので添字で管理）
let tail = 0;
let dots = 0;
for (let i = 0; i < H; i++) {
  const row = tok[2 + i];
  const base = (i + 1) * W2 + 1;
  for (let j = 0; j < W; j++) {
    const c = row.charCodeAt(j);
    if (c === 46) {
      free[base + j] = 1; // '.'
      dots++;
    } else if (c === 83) {
      queue[tail++] = base + j; // 'S' は距離 0 として最初からキューへ
    }
  }
}
if (tail === 0) {
  process.stdout.write(`-1 ${dots}\n`);
} else {
  const shelters = tail;
  const dist = new Int32Array(W2 * (H + 2));
  const step = [-1, 1, -W2, W2];
  let head = 0;
  let far = 0;
  while (head < tail) {
    const p = queue[head++];
    const d = dist[p] + 1;
    for (let k = 0; k < 4; k++) {
      const q = p + step[k];
      if (free[q]) {
        free[q] = 0;
        dist[q] = d;
        if (d > far) far = d;
        queue[tail++] = q;
      }
    }
  }
  const reached = tail - shelters; // キューに入った道のマスの数
  process.stdout.write(`${far} ${dots - reached}\n`);
}
