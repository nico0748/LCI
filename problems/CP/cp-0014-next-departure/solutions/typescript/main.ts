import { readFileSync } from "node:fs";

const tok = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const pad = (x: number): string => String(x).padStart(2, "0");
const n = Number(tok[0]);
const deps = tok.slice(1, 1 + n).map(toMin).sort((a, b) => a - b); // 数値の比較関数を渡す（既定は文字列順）
const q = Number(tok[1 + n]);
const out: string[] = [];
for (const s of tok.slice(2 + n, 2 + n + q)) {
  const u = toMin(s);
  let dep = deps.find((d) => d >= u); // ちょうどの時刻の便にも乗れる
  let wait: number;
  if (dep === undefined) {
    dep = deps[0]!; // 翌日の始発
    wait = dep + 1440 - u;
  } else {
    wait = dep - u;
  }
  out.push(`${pad(Math.floor(dep / 60))}:${pad(dep % 60)} ${wait}`);
}
process.stdout.write(out.join("\n") + "\n");
