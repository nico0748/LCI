import { readFileSync } from "node:fs";

const data = readFileSync(0, "utf8").split(/\s+/).filter(Boolean).map(Number);
const n = data[0]!;
const bookings: [number, number][] = [];
for (let i = 0; i < n; i++) bookings.push([data[1 + 2 * i]!, data[2 + 2 * i]!]);
// sort は比較関数を渡さないと文字列順になる
bookings.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
const merged: [number, number][] = [];
for (const [s, e] of bookings) {
  const last = merged[merged.length - 1];
  if (last && s <= last[1]) {
    last[1] = Math.max(last[1], e);
  } else {
    merged.push([s, e]);
  }
}
const out: string[] = [String(merged.length)];
for (const [s, e] of merged) out.push(`${s} ${e}`);
process.stdout.write(out.join("\n") + "\n");
