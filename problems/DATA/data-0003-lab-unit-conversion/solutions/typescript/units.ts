// 検査項目 → 単位 → [a, b, 桁数]。「基準単位の値 = 値 × a + b」。
// 比例でない換算（HbA1c、体温）も切片 b で表せるので、組合せごとの if を書かずに済む
const TABLE: Record<string, Record<string, [number, number, number]>> = {
  glucose: { "mg/dl": [1, 0, 0], "mmol/l": [18.0, 0, 1] },
  creatinine: { "mg/dl": [1, 0, 2], "μmol/l": [1 / 88.4, 0, 0] },
  cholesterol: { "mg/dl": [1, 0, 0], "mmol/l": [38.67, 0, 2] },
  hba1c: { "%": [1, 0, 1], "mmol/mol": [1 / 10.929, 2.15, 0] },
  body_temp: { "°c": [1, 0, 1], "°f": [5 / 9, (-32 * 5) / 9, 1] },
};
const ALIASES: Record<string, string> = { "umol/l": "μmol/l" };

// NFKC: ＭＧ／ＤＬ → MG/DL、µ（U+00B5）→ μ（U+03BC）、℃ → °C
export function normUnit(u: string): string {
  const s = u.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
  return ALIASES[s] ?? s;
}

// 0.5 を絶対値の大きい側へ丸める。toPrecision(15) で 2 進誤差を落とし、
// 指数表記の文字列で桁をずらすことで掛け算による誤差の再発を避ける
export function roundHalfUp(x: number, digits: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Number(Math.abs(x).toPrecision(15));
  const shifted = Math.round(Number(`${abs}e${digits}`));
  const r = sign * Number(`${shifted}e-${digits}`);
  return r === 0 ? 0 : r; // -0 を 0 にそろえる
}

export function convert(test: string, value: number, fromUnit: string, toUnit: string): number {
  const units = Object.hasOwn(TABLE, test) ? TABLE[test] : undefined;
  if (!units) throw new Error(`未知の検査項目: ${test}`);
  const from = units[normUnit(fromUnit)];
  const to = units[normUnit(toUnit)];
  if (!from || !to) throw new Error(`未知の単位: ${from ? toUnit : fromUnit}`);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("value は有限の数");
  const base = value * from[0] + from[1];
  return roundHalfUp((base - to[1]) / to[0], to[2]);
}
