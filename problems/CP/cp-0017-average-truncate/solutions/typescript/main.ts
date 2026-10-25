import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);
const names: string[] = [];
const scores: number[] = [];
for (let i = 0; i < n; i++) {
  names.push(tok[1 + 2 * i]!);
  scores.push(Number(tok[2 + 2 * i]));
}
const total = scores.reduce((a, x) => a + x, 0);
// 整数だけで: 平均×10 の切り捨て。toFixed(1) は四捨五入、String(70) は "70" になるので使わない
const v = Math.floor((total * 10) / n);
const out = [`${Math.floor(v / 10)}.${v % 10}`];
// 「平均以上」は正確な平均と比べる: score >= total / n ⇔ score * n >= total
for (let i = 0; i < n; i++) if (scores[i]! * n >= total) out.push(names[i]!);
process.stdout.write(out.join("\n") + "\n");
