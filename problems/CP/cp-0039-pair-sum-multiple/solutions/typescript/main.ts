import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((t) => t !== "");
const N = Number(tok[0]);
const M = Number(tok[1]);
// M は最大 10^9 なので大きさ M の配列は取らず、Map で余りごとの個数を数える
const cnt = new Map<number, number>();
let ans = 0; // 最大約 2×10^10 だが 2^53 未満なので Number で正確
for (let i = 0; i < N; i++) {
  const r = Number(tok[2 + i]) % M;
  ans += cnt.get((M - r) % M) ?? 0; // それまでに見た「組める余り」の袋の数
  cnt.set(r, (cnt.get(r) ?? 0) + 1);
}
process.stdout.write(`${ans}\n`);
