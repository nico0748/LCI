import { readFileSync } from "node:fs";

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}
function daysIn(y: number, m: number): number {
  if (m === 2) return isLeap(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}
const pad = (x: number, w: number) => String(x).padStart(w, "0");

// Date は使わない（new Date(2023, 1, 30) は 3/2 に繰り上がるため）。月の通し番号で整数計算する
const t = readFileSync(0, "utf8").split(/\s+/).filter((s) => s !== "");
const q = Number(t[0]);
const out: string[] = [];
for (let i = 0; i < q; i++) {
  const s = t[1 + 2 * i];
  const k = Number(t[2 + 2 * i]);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const idx = y * 12 + (m - 1) + k;
  const ty = Math.floor(idx / 12);
  const tm = (idx % 12) + 1;
  const last = daysIn(ty, tm);
  let ey: number;
  let em: number;
  let ed: number;
  if (d > last) {
    [ey, em, ed] = [ty, tm, last]; // 同じ日が無い → その月の末日
  } else if (d > 1) {
    [ey, em, ed] = [ty, tm, d - 1]; // 同じ日の前日
  } else {
    [ey, em] = tm > 1 ? [ty, tm - 1] : [ty - 1, 12]; // 1 日の前日は前の月の末日
    ed = daysIn(ey, em);
  }
  out.push(`${pad(ey, 4)}/${pad(em, 2)}/${pad(ed, 2)}`);
}
process.stdout.write(out.join("\n") + "\n");
