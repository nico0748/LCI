import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((t) => t !== "");
const N = Number(tok[0]);
const B = Number(tok[1]); // 10^15 と合計 2×10^14 は 2^53 未満なので Number で正確
const a = new Float64Array(N);
for (let i = 0; i < N; i++) a[i] = Number(tok[2 + i]);
let bestLen = 0;
let bestL = 0;
let s = 0;
let l = 0;
for (let r = 0; r < N; r++) {
  s += a[r];
  while (s > B) s -= a[l++]; // 費用は 0 以上なので、左端を進めれば合計は減る
  if (r - l + 1 > bestLen) {
    // 「>」で更新: 同じ長さなら先に見つかった（早い）開始日を残す
    bestLen = r - l + 1;
    bestL = l + 1;
  }
}
process.stdout.write(bestLen ? `${bestLen} ${bestL}\n` : "0\n");
