import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const x = Number(tok[1]);
const y = Number(tok[2]);
// 品名（tok[3 + 3i]）は使わない。単価 × 個数を足して小計を作る
let s = 0;
for (let i = 0; i < n; i++) s += Number(tok[4 + 3 * i]) * Number(tok[5 + 3 * i]);
// クーポンは「X 円以上」で使える。割引後は 0 円で止める
const t = s >= x ? Math.max(s - y, 0) : s;
// 税は整数で切り捨てる（t * 1.1 を出力すると小数が出る。/ は浮動小数の割り算なので floor する）
const tax = Math.floor((t * 10) / 100);
process.stdout.write(`${t + tax}\n`);
