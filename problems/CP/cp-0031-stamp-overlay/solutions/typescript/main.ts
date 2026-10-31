import { readFileSync } from "node:fs";

// 絵柄の行は空白を含まないので、空白区切りのトークンとして読める
const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
let p = 0;
const H = Number(tok[p++]);
const W = Number(tok[p++]);
const N = Number(tok[p++]);
const canvas: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill("."));
for (let k = 0; k < N; k++) {
  const h = Number(tok[p++]);
  const w = Number(tok[p++]);
  const r = Number(tok[p++]);
  const c = Number(tok[p++]);
  for (let i = 0; i < h; i++) {
    const y = r - 1 + i;
    if (y < 0 || y >= H) continue; // 配列の負の添字はエラーにならず無視されるだけなので、明示的に弾く
    const row = tok[p + i];
    for (let j = 0; j < w; j++) {
      const x = c - 1 + j;
      const ch = row[j];
      if (ch !== "." && x >= 0 && x < W) canvas[y][x] = ch;
    }
  }
  p += h;
}
process.stdout.write(canvas.map((line) => line.join("")).join("\n") + "\n");
