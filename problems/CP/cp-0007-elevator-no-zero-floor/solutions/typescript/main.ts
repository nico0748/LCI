import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const n = Number(tok[0]);

/** 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま） */
function level(s: string): number {
  return s[0] === "B" ? 1 - Number(s.slice(1)) : Number(s);
}

let total = 0;
for (let i = 2; i <= n; i++) total += Math.abs(level(tok[i]) - level(tok[i - 1]));
process.stdout.write(`${total}\n`);
