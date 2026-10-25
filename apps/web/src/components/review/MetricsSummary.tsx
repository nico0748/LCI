"use client";

import { fmtT, type Axis, type Metrics } from "@lci/core/browser";
import { Disclosure, cx } from "@/components/ui";
import { axisCode, metricTiles, type MetricTile } from "./review-model";

/**
 * 決定的に計算した指標（03 §2.3）。数値に解釈は添えないが、ルーブリックが定義している基準は「定義」として並べる（S2-3）。
 * 各指標がどの軸の根拠かを R 番号で示す。フェーズ推定はタイムラインのレーンに移した（S1-4）。
 */
export function MetricsSummary({
  metrics,
  onSeek,
  only,
  columns = 3,
  className,
}: {
  metrics: Metrics | null;
  onSeek: (t: number) => void;
  /** この軸の根拠になる指標だけ出す（軸別の根拠の中） */
  only?: Axis;
  columns?: 2 | 3 | 6;
  className?: string;
}) {
  if (!metrics) {
    return <p className={cx("text-std-14N-170 text-fg-muted", className)}>指標はセッションの処理が終わると表示されます。</p>;
  }
  const tiles = metricTiles(metrics).filter((m) => !only || m.axes.includes(only));
  if (!tiles.length) return null;
  const cols = columns === 6 ? "grid-cols-2 desktop:grid-cols-3 xl:grid-cols-6" : columns === 3 ? "grid-cols-2 desktop:grid-cols-3" : "grid-cols-1 desktop:grid-cols-2";
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <ul className={cx("grid gap-2", cols)}>
        {tiles.map((m) => (
          <Tile key={m.id} m={m} />
        ))}
      </ul>
      {!only && metrics.silence_gt15s.length > 0 && (
        <Disclosure summary="15 秒超の沈黙" meta={`${metrics.silence_gt15s.length} 件`}>
          <ul className="flex flex-col gap-0.5">
            {metrics.silence_gt15s.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => onSeek(s.t0)} className="flex items-center gap-3 rounded-4 px-1 py-1 text-left focus-ring-compact can-hover:bg-hover">
                  <span className="text-mono-12N-120 text-fg-body">
                    {fmtT(s.t0)}–{fmtT(s.t1)}
                  </span>
                  <span className="text-dns-13N-130 text-fg-muted tabular-nums">
                    {s.dur_s.toFixed(0)} 秒 · {s.editing ? "書きながら（R7）" : "手が止まっていた（R8）"}
                  </span>
                  <span aria-hidden className="text-dns-13N-130 text-link">
                    移動
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function Tile({ m }: { m: MetricTile }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-8 border border-border bg-surface p-3">
      <span className="flex items-start justify-between gap-2">
        <span className="text-dns-13N-130 text-fg-muted">{m.label}</span>
        {m.axes.length > 0 && <span className="shrink-0 text-mono-12N-120 text-fg-muted">{m.axes.map(axisCode).join(" ")}</span>}
      </span>
      <span className="text-oln-24B-100 text-fg">{m.value}</span>
      {m.detail && <span className="text-dns-13N-130 text-fg-muted">{m.detail}</span>}
      {m.benchmark && <span className="mt-auto border-t border-border-subtle pt-1.5 text-dns-13N-130 text-fg-body">{m.benchmark}</span>}
    </li>
  );
}
