/**
 * 履歴画面の軸別スパークライン用パス計算（S6）。
 * 値は左が古く右が新しい。欠損（null）は線を切る。
 */
export interface SparkOptions {
  width: number;
  height: number;
  min: number;
  max: number;
  /** 上下の余白（点が枠に触れないように） */
  pad?: number;
}

export function sparkPoints(values: (number | null)[], o: SparkOptions): ({ x: number; y: number } | null)[] {
  const pad = o.pad ?? 2;
  const n = values.length;
  const span = o.max - o.min || 1;
  return values.map((v, i) => {
    if (v == null) return null;
    const x = n <= 1 ? o.width / 2 : (i / (n - 1)) * o.width;
    const clamped = Math.min(o.max, Math.max(o.min, v));
    const y = o.height - pad - ((clamped - o.min) / span) * (o.height - pad * 2);
    return { x: round(x), y: round(y) };
  });
}

/** SVG path の d 属性。null で区切られた連続区間ごとに M..L.. を作る */
export function sparkPath(values: (number | null)[], o: SparkOptions): string {
  const pts = sparkPoints(values, o);
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x} ${p.y}`;
    pen = true;
  }
  return d;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
