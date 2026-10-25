import { readFileSync } from "node:fs";

const buf = readFileSync(0);
let pos = 0;
function nextInt(): number {
  while (buf[pos] < 48 || buf[pos] > 57) pos++;
  let x = 0;
  while (pos < buf.length && buf[pos] >= 48 && buf[pos] <= 57) x = x * 10 + buf[pos++] - 48;
  return x;
}

const DAY = 86400;
const n = nextInt();
// いもす法: [s, t) にいるので diff[s] += 1, diff[t] -= 1。t = 86400 があるので 86401 要素
const diff = new Int32Array(DAY + 1);
for (let i = 0; i < n; i++) {
  const s = nextInt();
  const t = nextInt();
  diff[s]++;
  diff[t]--;
}
let cur = 0;
let peak = -1;
let first = -1;
let seconds = 0;
for (let x = 0; x < DAY; x++) {
  cur += diff[x];
  if (cur > peak) {
    peak = cur;
    first = x;
    seconds = 1;
  } else if (cur === peak) {
    seconds++;
  }
}
process.stdout.write(`${peak}\n${first}\n${seconds}\n`);
