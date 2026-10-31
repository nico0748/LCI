import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const c = Number(tok[1]);
const s = new Float64Array(n);
const e = new Float64Array(n);
for (let i = 0; i < n; i++) {
  s[i] = Number(tok[2 + 2 * i]);
  e[i] = Number(tok[3 + 2 * i]);
}
// 終了時刻の早い順（数値の比較関数を渡す。既定の sort は文字列順）
const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => e[a]! - e[b]!);
let freeAt = 0; // 次の予約が始まってよい最も早い時刻 = 直前の終了 + C（最大 3×10^9。Number で正確、| 0 は使わない）
let cnt = 0;
for (const i of order) {
  if (s[i]! >= freeAt) {
    cnt++;
    freeAt = e[i]! + c;
  }
}
process.stdout.write(`${cnt}\n`);
