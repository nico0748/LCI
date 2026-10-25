import { readFileSync } from "node:fs";

const lines = readFileSync(0, "utf8").split("\n");
const [h, w, k] = lines[0].trim().split(/\s+/).map(Number);
// S[i * (W+1) + j] = 上 i 行・左 j 列の花の合計（0 の行と列を足した (H+1)×(W+1) を 1 次元で持つ）
const W1 = w + 1;
const S = new Int32Array((h + 1) * W1);
for (let i = 0; i < h; i++) {
  const g = lines[1 + i];
  const prev = i * W1;
  const base = (i + 1) * W1;
  let acc = 0;
  for (let j = 0; j < w; j++) {
    acc += g.charCodeAt(j) - 48;
    S[base + j + 1] = S[prev + j + 1] + acc;
  }
}
let best = -1;
let br = 0;
let bc = 0;
for (let r = 0; r + k <= h; r++) {
  const top = r * W1;
  const bot = (r + k) * W1;
  for (let c = 0; c + k <= w; c++) {
    const v = S[bot + c + k] - S[top + c + k] - S[bot + c] + S[top + c];
    if (v > best) {
      // 行優先で「より大きいときだけ」更新 → 同点は上・左が残る
      best = v;
      br = r;
      bc = c;
    }
  }
}
process.stdout.write(`${best}\n${br + 1} ${bc + 1}\n`);
