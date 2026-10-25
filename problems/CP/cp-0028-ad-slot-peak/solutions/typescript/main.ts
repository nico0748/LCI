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
// 時刻ごとの増減をまとめる（同じ時刻の終了 −c と開始 +c は先に相殺される = 終了を先に処理するのと同じ）
const delta = new Map<number, number>();
for (let i = 0; i < n; i++) {
  const s = nextInt();
  const e = nextInt();
  const c = nextInt();
  delta.set(s, (delta.get(s) ?? 0) + c);
  delta.set(e, (delta.get(e) ?? 0) - c);
}
// Float64Array の sort は数値の昇順（Array の sort は比較関数が無いと文字列順になる）
const times = Float64Array.from(delta.keys()).sort();
let cur = 0; // 合計は最大 10^14 で 2^53 未満なので number で正確
let best = -1;
let at = -1;
for (const x of times) {
  cur += delta.get(x)!;
  if (cur > best) {
    best = cur;
    at = x;
  }
}
process.stdout.write(`${best} ${at}\n`);
