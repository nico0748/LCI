import { AXES, type Axis } from "@lci/core/browser";
import { gridPolygons, labelPosition, pointsAttr, radarPoints, polar, axisAngle } from "./radar";

/**
 * 8 軸レーダー（03 §5.1）。1 系列なので凡例は置かず、総合点は中央に小さく出す（FR-E-09: 目立たせない）。
 * 軸ラベルをクリックすると該当軸の根拠に移動できるよう onSelectAxis を受ける。
 */
export function Radar({
  scores,
  overall,
  size = 260,
  selected,
  onSelectAxis,
}: {
  scores: Record<Axis, { score: number; confidence: number }>;
  overall: number;
  size?: number;
  selected?: Axis | null;
  onSelectAxis?: (axis: Axis) => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const n = AXES.length;
  const values = AXES.map((a) => scores[a.id].score);
  const pts = radarPoints(values, cx, cy, r);
  const grids = gridPolygons(n, cx, cy, r, 5);
  const desc = AXES.map((a) => `${a.label} ${scores[a.id].score}`).join("、");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`8 軸スコア: ${desc}`} className="block mx-auto max-w-full h-auto">
      <title>{`8 軸スコア: ${desc}`}</title>
      {grids.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="var(--border)" strokeWidth={i === grids.length - 1 ? 1 : 0.5} />
      ))}
      {AXES.map((_, i) => {
        const p = polar(cx, cy, r, axisAngle(i, n));
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={0.5} />;
      })}
      <polygon points={pointsAttr(pts)} fill="var(--accent)" fillOpacity={0.18} stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const a = AXES[i]!;
        const low = scores[a.id].confidence < 0.6;
        return (
          <g key={a.id}>
            <circle cx={p.x} cy={p.y} r={selected === a.id ? 5 : 3.5} fill={low ? "var(--bg-elev)" : "var(--accent)"} stroke="var(--accent)" strokeWidth={2}>
              <title>{`${a.label}: ${scores[a.id].score} / 5${low ? "（推測: confidence < 0.6）" : ""}`}</title>
            </circle>
          </g>
        );
      })}
      {AXES.map((a, i) => {
        const lp = labelPosition(i, n, cx, cy, r, 12);
        const isSel = selected === a.id;
        return (
          <text
            key={a.id}
            x={lp.x}
            y={lp.y}
            textAnchor={lp.anchor}
            dominantBaseline="middle"
            fontSize={11}
            fill={isSel ? "var(--fg)" : "var(--fg-muted)"}
            fontWeight={isSel ? 600 : 400}
            className={onSelectAxis ? "cursor-pointer" : undefined}
            onClick={onSelectAxis ? () => onSelectAxis(a.id) : undefined}
          >
            {a.label} {scores[a.id].score}
          </text>
        );
      })}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="var(--fg-muted)">
        総合 {overall.toFixed(1)}
      </text>
    </svg>
  );
}
