import { sparkPath, sparkPoints } from "./sparkline";

/**
 * 1 系列のスパークライン（S6 成長ダッシュボード）。
 * 凡例は置かない（系列は 1 本で、見出しが名前を兼ねる）。色は控えめにトークンから取る。
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  min = 1,
  max = 5,
  label,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  label: string;
}) {
  const o = { width, height, min, max, pad: 3 };
  const d = sparkPath(values, o);
  const pts = sparkPoints(values, o);
  const last = [...pts].reverse().find((p) => p != null) ?? null;
  const nums = values.filter((v): v is number => v != null);
  const desc = nums.length ? `${label}: ${nums.join(", ")}` : `${label}: データなし`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={desc} className="block overflow-visible">
      <title>{desc}</title>
      {/* 中央値 3 の基準線。recessive */}
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--border)" strokeWidth={1} />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last.x} cy={last.y} r={3} fill="var(--accent)" stroke="var(--bg-elev)" strokeWidth={2} />}
    </svg>
  );
}
