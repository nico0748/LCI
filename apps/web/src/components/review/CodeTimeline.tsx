"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fmtT, type Event, type Metrics, type Session, type Transcript } from "@lci/core/browser";
import { bucketEdits, densityOpacity, maxBucketChars, tToX, xToT } from "./density";
import { severityColor, verdictColor } from "./pins";
import type { Pin } from "./types";

/**
 * コードタイムライン・スクラバ（04 §6.4）。
 * - 発話レーン: 発話区間を細いバー、15 秒超の沈黙を薄い帯で示す
 * - ファイル別レーン: 編集密度（変更文字数, log スケール）を濃淡ブロックで示す
 * - ピン: Claude の feedback（severity 色）、run（判定色）、followup（細線）
 * クリック・ドラッグで seek。幅はコンテナを計測して px で描く（viewBox 伸縮だとマーカーが歪む）。
 */

const LANE_H = 18;
const SPEECH_H = 10;
const PIN_H = 16;
const AXIS_H = 14;
const LABEL_W = 88;
const BUCKETS = 240;

export function CodeTimeline({
  events,
  files,
  transcript,
  silences,
  duration,
  t,
  pins,
  selectedPinId,
  onSeek,
  onSelectPin,
}: {
  events: Event[];
  files: Session["files"];
  transcript: Transcript | null;
  silences: Metrics["silence_gt15s"] | undefined;
  duration: number;
  t: number;
  pins: Pin[];
  selectedPinId: string | null;
  onSeek: (t: number) => void;
  onSelectPin: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setWidth(Math.max(200, e.contentRect.width - LABEL_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fileOrder = useMemo(() => {
    const ids = files.map((f) => f.file_id);
    for (const e of events) if (e.type === "file_open" && !ids.includes(e.file)) ids.push(e.file);
    return ids;
  }, [files, events]);
  const nameOf = (id: string) => files.find((f) => f.file_id === id)?.path ?? id;
  const lanes = useMemo(() => bucketEdits(events, duration, BUCKETS, fileOrder).filter((l) => l.total > 0 || fileOrder.includes(l.file)), [events, duration, fileOrder]);
  const maxChars = useMemo(() => maxBucketChars(lanes), [lanes]);
  const speech = useMemo(() => (transcript?.segments ?? []).filter((s) => s.text.trim()), [transcript]);

  const height = PIN_H + SPEECH_H + 4 + lanes.length * LANE_H + AXIS_H + 6;
  const x = (tt: number) => LABEL_W + tToX(tt, width, duration);

  // ドラッグで seek
  const dragging = useRef(false);
  const seekFromPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(xToT(e.clientX - rect.left - LABEL_W, width, duration));
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-pin]")) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current) seekFromPointer(e);
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // 目盛り: 1 分刻み（長ければ 5 分）
  const tickStep = duration > 30 * 60_000 ? 5 * 60_000 : 60_000;
  const ticks: number[] = [];
  for (let tt = 0; tt <= duration; tt += tickStep) ticks.push(tt);

  const speechY = PIN_H;
  const lanesY = PIN_H + SPEECH_H + 4;
  const axisY = lanesY + lanes.length * LANE_H;

  return (
    <div ref={wrapRef} className="rounded-lg border border-border bg-bg-elev p-2 select-none">
      <svg
        width={LABEL_W + width}
        height={height}
        className="block touch-none cursor-crosshair"
        role="slider"
        aria-label="タイムライン"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(t / 1000)}
        aria-valuetext={fmtT(t)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 沈黙帯（背景） */}
        {silences?.map((s, i) => (
          <rect key={`sil${i}`} x={x(s.t0)} y={speechY} width={Math.max(1, x(s.t1) - x(s.t0))} height={axisY - speechY} fill="var(--fg-muted)" opacity={s.editing ? 0.08 : 0.14}>
            <title>{`沈黙 ${s.dur_s.toFixed(0)} 秒（${s.editing ? "編集あり" : "編集なし"}） ${fmtT(s.t0)}–${fmtT(s.t1)}`}</title>
          </rect>
        ))}

        {/* 発話レーン */}
        <text x={LABEL_W - 6} y={speechY + SPEECH_H / 2} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--fg-muted)">
          発話
        </text>
        {speech.map((s) => (
          <rect key={s.id} x={x(s.t_start)} y={speechY + 2} width={Math.max(1, x(s.t_end) - x(s.t_start))} height={SPEECH_H - 4} rx={1} fill="var(--fg-muted)" opacity={0.6} />
        ))}

        {/* ファイルレーン */}
        {lanes.map((lane, li) => {
          const y = lanesY + li * LANE_H;
          return (
            <g key={lane.file}>
              <text x={LABEL_W - 6} y={y + LANE_H / 2} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
                {truncate(nameOf(lane.file), 14)}
              </text>
              <line x1={LABEL_W} x2={LABEL_W + width} y1={y + LANE_H - 0.5} y2={y + LANE_H - 0.5} stroke="var(--border)" />
              {lane.buckets.map((b, bi) =>
                b.chars > 0 ? (
                  <rect key={bi} x={x(b.t0)} y={y + 3} width={Math.max(1, x(b.t1) - x(b.t0))} height={LANE_H - 6} fill="var(--accent)" opacity={densityOpacity(b.chars, maxChars)}>
                    <title>{`${nameOf(lane.file)} ${fmtT(b.t0)}–${fmtT(b.t1)}: ${b.edits} 編集 / ${b.chars} 文字`}</title>
                  </rect>
                ) : null,
              )}
            </g>
          );
        })}
        {lanes.length === 0 && (
          <text x={LABEL_W + 8} y={lanesY + 8} fontSize={11} fill="var(--fg-muted)">
            編集イベントがありません
          </text>
        )}

        {/* 目盛り */}
        {ticks.map((tt) => (
          <g key={tt}>
            <line x1={x(tt)} x2={x(tt)} y1={axisY} y2={axisY + 3} stroke="var(--fg-muted)" />
            <text x={x(tt)} y={axisY + AXIS_H} textAnchor="middle" fontSize={9} fill="var(--fg-muted)" fontFamily="var(--font-mono)">
              {fmtT(tt)}
            </text>
          </g>
        ))}

        {/* ピン */}
        {pins.map((p) => {
          const px = x(p.t);
          const sel = p.id === selectedPinId;
          const common = {
            "data-pin": p.id,
            className: "cursor-pointer",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectPin(p.id);
            },
          } as const;
          if (p.kind === "feedback") {
            const c = severityColor(p.severity);
            const r = sel ? 7 : 5;
            return (
              <g key={p.id} {...common}>
                <polygon points={`${px},${PIN_H / 2 - r} ${px + r},${PIN_H / 2} ${px},${PIN_H / 2 + r} ${px - r},${PIN_H / 2}`} fill={c} stroke="var(--bg-elev)" strokeWidth={sel ? 2 : 1} />
                <line x1={px} x2={px} y1={PIN_H} y2={axisY} stroke={c} strokeWidth={sel ? 1.5 : 0.75} opacity={sel ? 0.9 : 0.35} />
                <title>{`${fmtT(p.t)} [${p.severity}] ${p.label}`}</title>
              </g>
            );
          }
          if (p.kind === "run") {
            const c = verdictColor(p.verdict);
            return (
              <g key={p.id} {...common}>
                <polygon points={`${px - 4},${axisY - 1} ${px + 4},${axisY - 1} ${px},${axisY - 8}`} fill={c} stroke="var(--bg-elev)" strokeWidth={1} />
                <title>{`${fmtT(p.t)} 実行 ${p.label}`}</title>
              </g>
            );
          }
          return (
            <g key={p.id} {...common}>
              <line x1={px} x2={px} y1={PIN_H - 2} y2={axisY} stroke="var(--warn)" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={px} cy={PIN_H / 2} r={3} fill="var(--warn)" />
              <title>{`${fmtT(p.t)} 面接官: ${p.label}`}</title>
            </g>
          );
        })}

        {/* 再生ヘッド */}
        <line x1={x(t)} x2={x(t)} y1={0} y2={axisY + 3} stroke="var(--fg)" strokeWidth={1.5} />
        <rect x={x(t) - 18} y={axisY + 3} width={36} height={AXIS_H - 1} rx={2} fill="var(--fg)" />
        <text x={x(t)} y={axisY + AXIS_H - 2} textAnchor="middle" fontSize={9} fill="var(--bg)" fontFamily="var(--font-mono)">
          {fmtT(t)}
        </text>
      </svg>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? "…" + s.slice(-(n - 1)) : s;
}
