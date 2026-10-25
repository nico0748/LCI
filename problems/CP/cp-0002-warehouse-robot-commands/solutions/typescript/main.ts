import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const h = Number(tok[0]);
const w = Number(tok[1]);
const grid = tok.slice(2, 2 + h);
const cmds = tok[3 + h];
let r = 0;
let c = 0;
for (let i = 0; i < h; i++) {
  const j = grid[i].indexOf("S");
  if (j >= 0) {
    r = i;
    c = j;
  }
}
// 向き 0=北 1=東 2=南 3=西。L は (d + 3) % 4（JS の % は負の数に負を返すので d - 1 は使わない）
const dr = [-1, 0, 1, 0];
const dc = [0, 1, 0, -1];
const seen = new Uint8Array(h * w);
seen[r * w + c] = 1; // 出発マスも数える
let count = 1;
let d = 0;
for (let k = 0; k < cmds.length; k++) {
  const ch = cmds[k];
  if (ch === "F") {
    const nr = r + dr[d];
    const nc = c + dc[d];
    if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] !== "#") {
      r = nr;
      c = nc;
      if (!seen[r * w + c]) {
        seen[r * w + c] = 1;
        count++;
      }
    }
  } else if (ch === "R") {
    d = (d + 1) % 4;
  } else {
    d = (d + 3) % 4;
  }
}
process.stdout.write(`${r + 1} ${c + 1}\n${count}\n`);
