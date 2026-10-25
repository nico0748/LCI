import { readFileSync } from "node:fs";

const buf = readFileSync(0);
let pos = 0;
function nextInt(): number {
  while (buf[pos] < 48 || buf[pos] > 57) pos++;
  let x = 0;
  while (pos < buf.length && buf[pos] >= 48 && buf[pos] <= 57) x = x * 10 + buf[pos++] - 48;
  return x;
}

const n = nextInt();
const d = nextInt();
// dp[i] = 店 1..i だけを使ったときの割引の最大。最大 2×10^14 は 2^53 未満なので Float64Array で正確
const dp = new Float64Array(n + 1);
for (let i = 1; i <= n; i++) {
  const a = nextInt();
  const j = i - d; // 店 i で買うなら、直前に買えるのは店 i−D 以前
  const take = a + (j >= 0 ? dp[j] : 0);
  dp[i] = take > dp[i - 1] ? take : dp[i - 1];
}
process.stdout.write(`${dp[n]}\n`);
