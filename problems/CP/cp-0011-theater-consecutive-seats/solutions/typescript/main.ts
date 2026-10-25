import { readFileSync } from "node:fs";

const lines = readFileSync(0, "utf8").split("\n");
const [h, w, k] = lines[0]!.trim().split(/\s+/).map(Number) as [number, number, number];
let ans = "-1";
search: for (let r = 0; r < h; r++) {
  const row = lines[1 + r]!;
  let run = 0; // この列で、いま続いている空席の数（列が変わったら 0 から数え直す）
  for (let c = 0; c < w; c++) {
    if (row[c] === ".") {
      run++;
      if (run === k) {
        ans = `${r + 1} ${c - k + 2}`; // 左端は c - k + 1（0 始まり）→ 1 始まりに直す
        break search;
      }
    } else {
      run = 0;
    }
  }
}
process.stdout.write(ans + "\n");
