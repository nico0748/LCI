/**
 * WCAG 2.x のコントラスト比（相対輝度式）。
 * check-contrast スクリプトと /design のスウォッチ表示が同じ計算を使うよう、純関数として置く。
 */

/** "#rgb" / "#rrggbb" を 0–1 の RGB に。アルファ付き（#rrggbbaa）は受け付けない（合成前の値で比を出さないため） */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`hex 色ではありません: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** 小数 2 桁に切り捨てる（四捨五入で 4.495 を 4.50 と表示して合格に見せないため） */
export function formatRatio(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}

/** sRGB で a を p（0–1）の割合で b に混ぜる。固定値トークン（例: dark の eval-*-subtle）の導出用 */
export function mixHex(a: string, b: string, p: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round((v * p + B[i]! * (1 - p)) * 255)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}
