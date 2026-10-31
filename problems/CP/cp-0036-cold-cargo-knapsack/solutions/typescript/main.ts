import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((t) => t !== "").map(Number);
const N = tok[0];
const W = tok[1];
const C = tok[2];
// dp[c][w] = 冷蔵品 c 個以下・重さ w 以下での報酬の最大。合計は最大約 10^11 で 2^53 未満なので Float64Array で正確
const dp: Float64Array[] = Array.from({ length: C + 1 }, () => new Float64Array(W + 1));
for (let i = 0; i < N; i++) {
  const wi = tok[3 + 3 * i];
  const vi = tok[4 + 3 * i];
  const cold = tok[5 + 3 * i] === 1;
  if (wi > W) continue;
  // c も w も大きい方から更新する: 右辺の dp[c−(冷蔵)][w−wi] はまだこの荷物を使う前の値（0/1 を守る）
  for (let c = C; c >= (cold ? 1 : 0); c--) {
    const row = dp[c];
    const src = dp[cold ? c - 1 : c];
    for (let w = W; w >= wi; w--) {
      const cand = src[w - wi] + vi;
      if (cand > row[w]) row[w] = cand;
    }
  }
}
process.stdout.write(`${dp[C][W]}\n`);
