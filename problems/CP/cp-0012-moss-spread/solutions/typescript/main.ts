import { readFileSync } from "node:fs";

const lines = readFileSync(0, "utf8").split("\n");
const [h, w, t] = lines[0]!.trim().split(/\s+/).map(Number) as [number, number, number];
let g: string[][] = [];
for (let r = 0; r < h; r++) g.push(lines[1 + r]!.slice(0, w).split(""));

for (let day = 0; day < t; day++) {
  // 二重バッファ: 判定は前の日の g、書き込みは新しい nxt（行ごとにコピーする）
  const nxt = g.map((row) => row.slice());
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = g[r]![c]!;
      if (ch === "#") continue;
      let m = 0; // 上下左右の苔の数（盤の外は数えない）
      if (r > 0 && g[r - 1]![c] === "o") m++;
      if (r + 1 < h && g[r + 1]![c] === "o") m++;
      if (c > 0 && g[r]![c - 1] === "o") m++;
      if (c + 1 < w && g[r]![c + 1] === "o") m++;
      if (ch === ".") {
        if (m >= 2) nxt[r]![c] = "o";
      } else if (m === 0 || m === 4) {
        nxt[r]![c] = ".";
      }
    }
  }
  g = nxt;
}
process.stdout.write(g.map((row) => row.join("")).join("\n") + "\n");
