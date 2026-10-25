import { readFileSync } from "node:fs";

const buf = readFileSync(0); // Buffer のまま扱う（10^6 文字を文字列に分割しない）
let p = 0;
const readInt = (): number => {
  while (buf[p]! < 48) p++;
  let x = 0;
  while (p < buf.length && buf[p]! >= 48) x = x * 10 + buf[p++]! - 48;
  return x;
};
const h = readInt();
const w = readInt();
const w2 = w + 2;
// 周りを壁（0）で 1 周囲んだ 1 次元の盤。1 = 未訪問の空き区画
const g = new Uint8Array((h + 2) * w2);
for (let r = 1; r <= h; r++) {
  while (buf[p] !== 46 && buf[p] !== 35) p++; // 行の先頭（"." か "#"）まで進む
  for (let c = 1; c <= w; c++) g[r * w2 + c] = buf[p++] === 46 ? 1 : 0;
}
const stack = new Int32Array(h * w + 1); // 再帰ではなく明示的なスタック（深さ 10^6 でも落ちない）
let count = 0;
let best = 0;
for (let v = w2; v < (h + 1) * w2; v++) {
  if (g[v] !== 1) continue;
  count++;
  g[v] = 0; // 訪問済みの印は積むときに付ける
  let top = 0;
  stack[top++] = v;
  let area = 0;
  while (top > 0) {
    const x = stack[--top]!;
    area++;
    for (const y of [x - 1, x + 1, x - w2, x + w2]) {
      if (g[y] === 1) {
        g[y] = 0;
        stack[top++] = y;
      }
    }
  }
  if (area > best) best = area;
}
process.stdout.write(`${count} ${best}\n`);
