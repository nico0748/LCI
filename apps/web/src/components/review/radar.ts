/**
 * 8 軸レーダーの座標計算（03 §5.1）。
 * 軸は 12 時方向から時計回り。値は 1..5 を 0..r に写す（1 点を中心に置くと 1 が「無」に見えるので min を 0 にする）。
 */
export interface RadarPoint {
  x: number;
  y: number;
}

export function axisAngle(i: number, n: number): number {
  return -Math.PI / 2 + (2 * Math.PI * i) / n;
}

export function polar(cx: number, cy: number, r: number, angle: number): RadarPoint {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** score（min..max）を半径に写す */
export function scoreRadius(score: number, r: number, min = 0, max = 5): number {
  const v = Math.min(max, Math.max(min, score));
  return ((v - min) / (max - min)) * r;
}

export function radarPoints(scores: number[], cx: number, cy: number, r: number, min = 0, max = 5): RadarPoint[] {
  const n = scores.length;
  return scores.map((s, i) => polar(cx, cy, scoreRadius(s, r, min, max), axisAngle(i, n)));
}

export function pointsAttr(pts: RadarPoint[]): string {
  return pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

/** 目盛り多角形（levels 本） */
export function gridPolygons(n: number, cx: number, cy: number, r: number, levels: number): string[] {
  const out: string[] = [];
  for (let l = 1; l <= levels; l++) {
    const rr = (r * l) / levels;
    out.push(pointsAttr(Array.from({ length: n }, (_, i) => polar(cx, cy, rr, axisAngle(i, n)))));
  }
  return out;
}

/** ラベル位置（外側に少し出す）と text-anchor */
export function labelPosition(i: number, n: number, cx: number, cy: number, r: number, pad: number): RadarPoint & { anchor: "start" | "middle" | "end" } {
  const a = axisAngle(i, n);
  const p = polar(cx, cy, r + pad, a);
  const c = Math.cos(a);
  const anchor = Math.abs(c) < 0.15 ? "middle" : c > 0 ? "start" : "end";
  return { ...p, anchor };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
