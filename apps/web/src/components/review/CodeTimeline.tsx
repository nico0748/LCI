"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { fmtT, type Event, type Metrics, type Session, type Transcript } from "@lci/core/browser";
import { EvalGlyph, EVAL_LABEL, evalLevelOf, cx, DangerIcon, SuccessIcon } from "@/components/ui";
import { bucketEdits, maxBucketChars, mergeLanes, tToX, xToT, type FileLane } from "./density";
import { bucketCountFor, editLevel, editLevelBounds, stackRows, tickStepFor, tickTimes } from "./timeline-layout";
import { AXIS_LABEL, fmtDuration, fmtRange } from "./review-model";
import type { Pin } from "./types";
import type { Axis } from "@lci/core/browser";

/**
 * タイムライン（04 §3）。レーンは上から 目盛り / 指摘 / 面接官 / フェーズ / 発話 / ファイル別の編集量 / 実行。
 * - 指摘は形（▲◆●✓）＋番号。範囲を持つ指摘は 2px の範囲バー。選択中は範囲を全レーンに 10% の wash
 * - 編集量は 4 段の sequential（不透明度は使わない）。沈黙は発話レーンの中だけに枠で示す
 * - フェーズは色を使わず、無彩色の帯に文字（X3）
 * - スクラブ領域は role="slider"（←→ 5 秒、Shift で 1 秒、Home/End、Space で再生/停止）。ピンは role="toolbar"（←→ で移動、Enter で選択）
 * - 幅が狭い（モバイルの sticky プレイヤー）ときは レーン名・面接官・フェーズを省き、ファイルを 1 本に合算する
 * 描画はコンテナの実測幅で px を決める（viewBox の伸縮はマーカーを歪めるため）。
 */

const LABEL_W = 96;
const COMPACT_BELOW = 640;
const H = { axis: 22, pins: 30, followup: 18, phase: 20, speech: 18, file: 18, run: 20 } as const;

const PHASE_LABEL: Record<Metrics["phase_estimate"][number]["phase"], string> = {
  design: "設計",
  implement: "実装",
  verify: "検証",
  polish: "整形",
  idle: "停滞",
};

const SEQ_FILL = ["", "var(--viz-seq-1)", "var(--viz-seq-2)", "var(--viz-seq-3)", "var(--viz-seq-4)"] as const;
const EVAL_FILL = { major: "var(--eval-major)", minor: "var(--eval-minor)", good: "var(--eval-good)" } as const;

type LaneKind = "pins" | "followup" | "phase" | "speech" | "file" | "run";
interface LaneDef {
  key: string;
  kind: LaneKind;
  label: string;
  y: number;
  h: number;
  lane?: FileLane;
}

interface Tip {
  x: number;
  y: number;
  lines: ReactNode[];
}

export function CodeTimeline({
  events,
  files,
  transcript,
  metrics,
  duration,
  t,
  pins,
  eventPins,
  selectedPinId,
  feedbackAxis,
  onSeek,
  onSelectPin,
  onOpenTable,
  onTogglePlay,
}: {
  events: Event[];
  files: Session["files"];
  transcript: Transcript | null;
  metrics: Metrics | null;
  duration: number;
  t: number;
  /** 指摘のピン（番号付き） */
  pins: Pin[];
  /** 実行・面接官の問いかけ */
  eventPins: Pin[];
  selectedPinId: string | null;
  /** 指摘 id → 軸（ツールチップ用） */
  feedbackAxis: Map<string, Axis>;
  onSeek: (t: number) => void;
  onSelectPin: (id: string) => void;
  onOpenTable: () => void;
  /** スライダー上の Space（ページをスクロールさせず、再生/停止にする） */
  onTogglePlay: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [outerW, setOuterW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setOuterW(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = outerW > 0 && outerW < COMPACT_BELOW;
  const labelW = compact ? 0 : LABEL_W;
  const plotW = Math.max(0, outerW - labelW - 8);
  const x = (tt: number) => labelW + tToX(tt, plotW, duration);

  // ---- データ ------------------------------------------------------------
  const fileOrder = useMemo(() => {
    const ids = files.map((f) => f.file_id);
    for (const e of events) if (e.type === "file_open" && !ids.includes(e.file)) ids.push(e.file);
    return ids;
  }, [files, events]);
  const nameOf = useMemo(() => {
    const m = new Map(files.map((f) => [f.file_id, f.path]));
    return (id: string) => m.get(id) ?? id;
  }, [files]);
  const nBuckets = bucketCountFor(plotW || 600);
  const fileLanes = useMemo(() => {
    const lanes = bucketEdits(events, duration, nBuckets, fileOrder).filter((l) => l.total > 0 || fileOrder.includes(l.file));
    if (!compact) return lanes;
    const merged = mergeLanes(lanes, "編集");
    return merged ? [merged] : [];
  }, [events, duration, nBuckets, fileOrder, compact]);
  const maxChars = useMemo(() => maxBucketChars(fileLanes), [fileLanes]);
  const bounds = useMemo(() => editLevelBounds(maxChars), [maxChars]);
  const speech = useMemo(() => (transcript?.segments ?? []).filter((s) => s.text.trim()), [transcript]);
  const silences = metrics?.silence_gt15s ?? [];
  const phases = (metrics?.phase_estimate ?? []).filter((p) => p.t1 > p.t0);
  const runs = eventPins.filter((p) => p.kind === "run");
  const followups = eventPins.filter((p) => p.kind === "followup");

  // ---- レーン配置 ----------------------------------------------------------
  const lanes: LaneDef[] = [];
  let y = H.axis;
  const push = (key: string, kind: LaneKind, label: string, h: number, lane?: FileLane) => {
    lanes.push({ key, kind, label, y, h, lane });
    y += h;
  };
  if (pins.length) push("pins", "pins", "指摘", H.pins);
  if (!compact && followups.length) push("followup", "followup", "面接官", H.followup);
  if (!compact && phases.length) push("phase", "phase", "フェーズ", H.phase);
  push("speech", "speech", "発話", H.speech);
  for (const l of fileLanes) push(`f:${l.file}`, "file", compact ? "編集" : nameOf(l.file), H.file, l);
  if (runs.length) push("run", "run", "実行", H.run);
  const height = y + 4;
  const plotTop = H.axis;
  const laneOf = (kind: LaneKind) => lanes.find((l) => l.kind === kind);

  // ---- 目盛り --------------------------------------------------------------
  const step = tickStepFor(duration, plotW);
  const ticks = tickTimes(duration, step);
  const headX = x(t);
  const headLabelHalf = 24;

  // ---- ピンの段組み ----------------------------------------------------------
  const pinRows = useMemo(() => stackRows(pins.map((p) => tToX(p.t, plotW, duration)), compact ? 22 : 30, 2), [pins, plotW, duration, compact]);
  const twoRows = pinRows.some((r) => r > 0);
  const selected = pins.find((p) => p.id === selectedPinId) ?? null;
  const selectedLevel = selected ? evalLevelOf(selected.severity ?? "") : null;

  // ---- スクラブ（ポインタ）とホバー ---------------------------------------------
  const dragging = useRef(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const tFromClient = (clientX: number, el: HTMLElement) => xToT(clientX - el.getBoundingClientRect().left, plotW, duration);

  const describeAt = (tt: number, localY: number): ReactNode[] | null => {
    const lane = lanes.find((l) => localY >= l.y && localY < l.y + l.h);
    const head = <strong key="t">{fmtT(tt)}</strong>;
    if (!lane) return [head];
    switch (lane.kind) {
      case "file": {
        const b = lane.lane?.buckets.find((bk) => tt >= bk.t0 && tt < bk.t1);
        if (!b || b.chars === 0) return [head, `${lane.label} · 編集なし`];
        const lv = editLevel(b.chars, maxChars);
        return [<strong key="t">{`${b.edits} 編集 / ${b.chars} 文字`}</strong>, `${lane.label} ${fmtT(b.t0)}–${fmtT(b.t1)}`, `編集量 ${lv}/4（〜${bounds[lv - 1]} 文字）`];
      }
      case "speech": {
        const sil = silences.find((s) => tt >= s.t0 && tt < s.t1);
        if (sil) return [<strong key="t">{`沈黙 ${sil.dur_s.toFixed(0)} 秒`}</strong>, `${fmtT(sil.t0)}–${fmtT(sil.t1)} · ${sil.editing ? "編集あり" : "編集なし"}`];
        const seg = speech.find((s) => tt >= s.t_start && tt < s.t_end);
        return seg ? [<strong key="t">{fmtRange(seg.t_start, seg.t_end)}</strong>, seg.text] : [head, "発話なし"];
      }
      case "phase": {
        const ph = phases.find((p) => tt >= p.t0 && tt < p.t1);
        return ph ? [<strong key="t">{PHASE_LABEL[ph.phase]}</strong>, `${fmtRange(ph.t0, ph.t1)}（${fmtDuration(ph.t1 - ph.t0)}）`, "推定（発話と編集から）"] : [head];
      }
      default:
        return [head];
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(tFromClient(e.clientX, e.currentTarget));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const tt = tFromClient(e.clientX, el);
    if (dragging.current) onSeek(tt);
    if (e.pointerType === "mouse") {
      const rect = el.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      setHoverX(labelW + lx);
      const lines = describeAt(tt, e.clientY - rect.top + plotTop);
      setTip(lines ? { x: labelW + lx, y: e.clientY - rect.top + plotTop, lines } : null);
    }
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onLeave = () => {
    setTip(null);
    setHoverX(null);
  };

  const onSliderKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const fine = e.shiftKey ? 1000 : 5000;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = t - fine;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = t + fine;
    else if (e.key === "PageDown") next = t - 30_000;
    else if (e.key === "PageUp") next = t + 30_000;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = duration;
    else if (e.key === " ") {
      e.preventDefault();
      onTogglePlay();
      return;
    }
    if (next != null) {
      e.preventDefault();
      onSeek(next);
    }
  };

  // ---- ピンのツールバー（roving tabindex）-------------------------------------
  const pinRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const selectedIdx = pins.findIndex((p) => p.id === selectedPinId);
  const rovingIdx = selectedIdx >= 0 ? selectedIdx : Math.min(focusIdx, Math.max(0, pins.length - 1));
  const onToolbarKey = (e: ReactKeyboardEvent<HTMLDivElement>, refs: Array<HTMLButtonElement | null>, count: number) => {
    const cur = refs.findIndex((r) => r === document.activeElement);
    if (cur < 0) return;
    let to: number | null = null;
    if (e.key === "ArrowRight") to = Math.min(count - 1, cur + 1);
    else if (e.key === "ArrowLeft") to = Math.max(0, cur - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = count - 1;
    if (to != null) {
      e.preventDefault();
      refs[to]?.focus();
    }
  };
  const evRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [evFocus, setEvFocus] = useState(0);

  const pinTip = (p: Pin, px: number, py: number): Tip => {
    const level = evalLevelOf(p.severity ?? "");
    const axis = feedbackAxis.get(p.id);
    return {
      x: px,
      y: py,
      lines: [
        <strong key="a">{`#${p.n ?? "?"} ${fmtRange(p.t, p.tEnd)}${p.tEnd ? `（${fmtDuration(p.tEnd - p.t)}）` : ""}`}</strong>,
        `${level ? EVAL_LABEL.feedback[level] : ""}${axis ? ` · ${AXIS_LABEL[axis]}` : ""}`,
        p.label,
        "Enter で選択",
      ],
    };
  };
  const eventTip = (p: Pin, px: number, py: number): Tip => ({
    x: px,
    y: py,
    lines: p.kind === "run" ? [<strong key="a">{`${fmtT(p.t)} 実行`}</strong>, p.label] : [<strong key="a">{`${fmtT(p.t)} 面接官の問いかけ`}</strong>, p.label],
  });

  const pinsLane = laneOf("pins") ?? { y: plotTop, h: H.pins };
  const runLane = laneOf("run");
  const fuLane = laneOf("followup");
  const pinCenterY = (row: number) => (twoRows ? pinsLane.y + (row === 0 ? 9 : 21) : pinsLane.y + pinsLane.h / 2 - 2);

  // 選択中の指摘の範囲（全レーンの wash）
  const washFrom = selected ? x(selected.t) : 0;
  const washTo = selected ? x(selected.tEnd ?? selected.t) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-dns-13N-130 text-fg-muted">
        <span className={cx("flex-wrap items-center gap-x-3 gap-y-1", compact ? "hidden" : "flex")}>
          {pins.length > 0 && (
            <>
              <LegendItem icon={<EvalGlyph level="major" size={12} className="text-eval-major" />}>重大</LegendItem>
              <LegendItem icon={<EvalGlyph level="minor" size={12} className="text-eval-minor" />}>改善</LegendItem>
              <LegendItem icon={<EvalGlyph level="good" size={12} className="text-eval-good" />}>良い</LegendItem>
            </>
          )}
          {followups.length > 0 && <LegendItem icon={<FollowupIcon />}>面接官</LegendItem>}
          {runs.length > 0 && (
            <LegendItem
              icon={
                <span className="inline-flex gap-0.5">
                  <SuccessIcon size={12} className="text-success" />
                  <DangerIcon size={12} className="text-danger" />
                </span>
              }
            >
              実行
            </LegendItem>
          )}
          {silences.length > 0 && <LegendItem icon={<span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] border border-border-strong" />}>沈黙 15 秒超</LegendItem>}
          {fileLanes.length > 0 && (
            <span className="inline-flex items-center gap-1">
              編集量 少
              <span aria-hidden className="inline-flex gap-0.5">
                {[1, 2, 3, 4].map((k) => (
                  <span key={k} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SEQ_FILL[k] }} />
                ))}
              </span>
              多
            </span>
          )}
        </span>
        <button type="button" onClick={onOpenTable} className="ml-auto rounded-4 px-1 text-dns-13N-130 text-link underline underline-offset-[3px] focus-text">
          表で見る
        </button>
      </div>

      <div ref={wrapRef} className="relative select-none" style={{ height }}>
        {outerW > 0 && (
          <>
            <svg width={outerW} height={height} className="absolute inset-0 block" aria-hidden="true">
              {/* レーンの区切りとレーン名 */}
              {lanes.map((l) => (
                <g key={l.key}>
                  <line x1={labelW} x2={labelW + plotW} y1={l.y + l.h - 0.5} y2={l.y + l.h - 0.5} stroke="var(--border-subtle)" />
                  {!compact && (
                    <text
                      x={labelW - 8}
                      y={l.y + l.h / 2}
                      textAnchor="end"
                      dominantBaseline="central"
                      fill="var(--fg-muted)"
                      style={{ font: l.kind === "file" ? "400 12px/1 var(--font-mono)" : "400 13px/1 var(--font-sans)" }}
                    >
                      {truncate(l.label, l.kind === "file" ? 12 : 6)}
                    </text>
                  )}
                </g>
              ))}

              {/* 目盛りの縦線（recessive） */}
              {ticks.map((tt) => (
                <line key={`g${tt}`} x1={x(tt)} x2={x(tt)} y1={plotTop} y2={height - 4} stroke="var(--border-subtle)" />
              ))}

              {/* 選択中の指摘の範囲 */}
              {selected && selectedLevel && (
                <rect x={washFrom - (washTo - washFrom < 2 ? 1 : 0)} y={plotTop} width={Math.max(2, washTo - washFrom)} height={height - 4 - plotTop} fill={EVAL_FILL[selectedLevel]} opacity={washTo - washFrom < 2 ? 0.6 : 0.1} />
              )}

              {/* 範囲を持つ指摘の範囲バー */}
              {pins.map((p, i) => {
                const level = evalLevelOf(p.severity ?? "");
                if (!p.tEnd || !level) return null;
                const cy = pinCenterY(pinRows[i] ?? 0) + 8;
                return <line key={`r${p.id}`} x1={x(p.t)} x2={x(p.tEnd)} y1={cy} y2={cy} stroke={EVAL_FILL[level]} strokeWidth={2} strokeLinecap="round" />;
              })}

              {/* フェーズ（無彩色。停滞だけ枠） */}
              {laneOf("phase") &&
                phases.map((p, i) => {
                  const l = laneOf("phase")!;
                  const x0 = x(p.t0) + 1;
                  const w = Math.max(1, x(p.t1) - x(p.t0) - 2);
                  const label = PHASE_LABEL[p.phase];
                  const fits = w >= label.length * 13 + 8;
                  const idle = p.phase === "idle";
                  return (
                    <g key={`ph${i}`}>
                      <rect x={x0} y={l.y + 2} width={w} height={l.h - 5} rx={2} fill={idle ? "var(--bg-surface)" : "var(--bg-hover)"} stroke={idle ? "var(--border-strong)" : "none"} />
                      {fits && (
                        <text x={x0 + 6} y={l.y + l.h / 2} dominantBaseline="central" fill={idle ? "var(--fg-muted)" : "var(--fg-body)"} style={{ font: "400 13px/1 var(--font-sans)" }}>
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* 発話（中立）と沈黙（発話レーンの中だけ） */}
              {(() => {
                const l = laneOf("speech")!;
                return (
                  <g>
                    {speech.map((s) => (
                      <rect key={s.id} x={x(s.t_start)} y={l.y + l.h / 2 - 3} width={Math.max(2, x(s.t_end) - x(s.t_start) - 1)} height={6} rx={2} fill="var(--viz-neutral)" />
                    ))}
                    {silences.map((s, i) => {
                      const x0 = x(s.t0) + 0.5;
                      const w = Math.max(2, x(s.t1) - x(s.t0) - 1);
                      const label = `沈黙 ${s.dur_s.toFixed(0)}s`;
                      return (
                        <g key={`s${i}`}>
                          <rect x={x0} y={l.y + 2.5} width={w} height={l.h - 6} rx={2} fill="var(--bg-surface)" stroke="var(--border-strong)" />
                          {w > label.length * 8 + 8 && (
                            <text x={x0 + 5} y={l.y + l.h / 2 - 0.5} dominantBaseline="central" fill="var(--fg-muted)" style={{ font: "400 12px/1 var(--font-sans)" }}>
                              {label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* 編集量（4 段、2px の面ギャップ） */}
              {lanes
                .filter((l) => l.kind === "file")
                .map((l) => (
                  <g key={`b${l.key}`}>
                    {l.lane!.buckets.map((b, bi) => {
                      const lv = editLevel(b.chars, maxChars);
                      if (!lv) return null;
                      const x0 = x(b.t0);
                      const w = x(b.t1) - x0;
                      const gap = w >= 8 ? 2 : 1;
                      return <rect key={bi} x={x0} y={l.y + 3} width={Math.max(1, w - gap)} height={l.h - 7} rx={1} fill={SEQ_FILL[lv]} />;
                    })}
                  </g>
                ))}
              {fileLanes.length === 0 && (
                <text x={labelW + 8} y={(laneOf("speech")?.y ?? 0) + 30} fill="var(--fg-muted)" style={{ font: "400 13px/1 var(--font-sans)" }}>
                  編集の記録がありません
                </text>
              )}

              {/* 目盛り（上端）。再生ヘッドのラベルと重なるものは出さない */}
              {ticks.map((tt) => {
                const tx = x(tt);
                if (Math.abs(tx - headX) < headLabelHalf + 22) return null;
                const anchor = tt === 0 ? "start" : tt >= duration - 1 ? "end" : "middle";
                return (
                  <text key={`t${tt}`} x={tx} y={H.axis / 2} textAnchor={anchor} dominantBaseline="central" fill="var(--fg-muted)" style={{ font: "400 12px/1 var(--font-mono)" }}>
                    {fmtT(tt)}
                  </text>
                );
              })}

              {/* ホバー位置 */}
              {hoverX != null && <line x1={hoverX} x2={hoverX} y1={plotTop} y2={height - 4} stroke="var(--fg-muted)" strokeWidth={1} />}

              {/* 再生ヘッド（accent）と時刻（inverse） */}
              <line x1={headX} x2={headX} y1={plotTop - 2} y2={height - 4} stroke="var(--accent)" strokeWidth={2} />
              {(() => {
                const lx = Math.min(Math.max(headX - headLabelHalf, 0), outerW - headLabelHalf * 2);
                return (
                  <g>
                    <rect x={lx} y={1} width={headLabelHalf * 2} height={H.axis - 4} rx={3} fill="var(--bg-inverse)" />
                    <text x={lx + headLabelHalf} y={H.axis / 2 - 1} textAnchor="middle" dominantBaseline="central" fill="var(--fg-inverse)" style={{ font: "400 12px/1 var(--font-mono)" }}>
                      {fmtT(t)}
                    </text>
                  </g>
                );
              })()}
            </svg>

            {/* スクラブ領域（slider）。ピンのボタンはこの上に重ねる */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="再生位置"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration / 1000)}
              aria-valuenow={Math.round(t / 1000)}
              aria-valuetext={`${fmtT(t)} / ${fmtT(duration)}`}
              aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Home End Space"
              className="absolute touch-none cursor-col-resize rounded-4 focus-ring-inset"
              style={{ left: labelW, top: plotTop, width: plotW, height: height - plotTop - 2 }}
              onKeyDown={onSliderKey}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={onLeave}
            />

            {/* 指摘のピン（toolbar） */}
            {pins.length > 0 && (
              <div role="toolbar" aria-label="指摘のピン" aria-orientation="horizontal" onKeyDown={(e) => onToolbarKey(e, pinRefs.current, pins.length)}>
                {pins.map((p, i) => {
                  const level = evalLevelOf(p.severity ?? "");
                  const cx0 = x(p.t);
                  const cy = pinCenterY(pinRows[i] ?? 0);
                  const sel = p.id === selectedPinId;
                  const name = `#${p.n ?? ""} ${level ? EVAL_LABEL.feedback[level] : ""} ${fmtRange(p.t, p.tEnd)} ${p.label}`;
                  return (
                    <button
                      key={p.id}
                      ref={(el) => {
                        pinRefs.current[i] = el;
                      }}
                      type="button"
                      tabIndex={i === rovingIdx ? 0 : -1}
                      aria-label={name}
                      aria-pressed={sel}
                      data-pin={p.id}
                      onClick={() => onSelectPin(p.id)}
                      onFocus={() => {
                        setFocusIdx(i);
                        setTip(pinTip(p, cx0, cy - 4));
                      }}
                      onBlur={() => setTip(null)}
                      onPointerEnter={() => setTip(pinTip(p, cx0, cy - 4))}
                      onPointerLeave={() => setTip(null)}
                      className={cx(
                        "absolute z-10 flex h-6 min-w-6 items-center gap-0.5 rounded-4 pl-[3px] pr-1 focus-ring-compact",
                        "can-hover:bg-surface can-hover:shadow-1",
                        sel && "after:absolute after:inset-x-0.5 after:-bottom-0.5 after:h-0.5 after:bg-accent",
                      )}
                      style={{ left: cx0 - 9, top: cy - 12 }}
                    >
                      {level && <EvalGlyph level={level} size={12} className={level === "major" ? "text-eval-major" : level === "minor" ? "text-eval-minor" : "text-eval-good"} />}
                      {!compact && p.n != null && <span className="text-mono-12N-120 text-fg-body">{p.n}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 実行・面接官（toolbar） */}
            {(runs.length > 0 || followups.length > 0) && (
              <div role="toolbar" aria-label="実行と面接官の問いかけ" aria-orientation="horizontal" onKeyDown={(e) => onToolbarKey(e, evRefs.current, runs.length + followups.length)}>
                {[...runs, ...followups].map((p, i) => {
                  const lane = p.kind === "run" ? runLane : fuLane;
                  if (!lane) return null;
                  const cx0 = x(p.t);
                  const cy = lane.y + lane.h / 2;
                  const ok = p.verdict === "AC" || p.verdict === "PASS";
                  const name = p.kind === "run" ? `${fmtT(p.t)} 実行 ${p.label}` : `${fmtT(p.t)} 面接官: ${p.label}`;
                  return (
                    <button
                      key={p.id}
                      ref={(el) => {
                        evRefs.current[i] = el;
                      }}
                      type="button"
                      tabIndex={i === Math.min(evFocus, runs.length + followups.length - 1) ? 0 : -1}
                      aria-label={name}
                      onClick={() => onSelectPin(p.id)}
                      onFocus={() => {
                        setEvFocus(i);
                        setTip(eventTip(p, cx0, cy - 6));
                      }}
                      onBlur={() => setTip(null)}
                      onPointerEnter={() => setTip(eventTip(p, cx0, cy - 6))}
                      onPointerLeave={() => setTip(null)}
                      className="absolute z-10 flex h-6 min-w-6 items-center gap-1 rounded-4 px-[3px] focus-ring-compact can-hover:bg-surface can-hover:shadow-1"
                      style={{ left: cx0 - 9, top: cy - 12 }}
                    >
                      {p.kind === "run" ? (
                        <>
                          {ok ? <SuccessIcon size={12} className="text-success" /> : <DangerIcon size={12} className="text-danger" />}
                          {!compact && p.verdict && <span className={cx("text-mono-12N-120", ok ? "text-success" : "text-danger")}>{p.verdict}</span>}
                        </>
                      ) : (
                        <FollowupIcon />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {tip && <Tooltip tip={tip} width={outerW} />}
          </>
        )}
      </div>
    </div>
  );
}

function LegendItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {children}
    </span>
  );
}

/** 面接官の問いかけ（吹き出しに ?）。中立色 */
function FollowupIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" width={13} height={13} className="shrink-0 text-fg-muted">
      <path d="M2 1.5h10a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H6.5L3.5 13v-3H2a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.4 4.6a1.6 1.6 0 1 1 2.2 1.5c-.4.2-.6.5-.6.9v.3M7 8.6v.1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** ツールチップ（補助。同じ情報は指摘一覧と表で読める）。値を先に、ラベルを後に */
function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  const W = 248;
  const left = Math.min(Math.max(0, tip.x - W / 2), Math.max(0, width - W));
  // 上端のレーン（指摘）は上に出すとトランスポートを隠すので、下に出す
  const below = tip.y < 72;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-20 flex max-w-[248px] flex-col gap-0.5 rounded-4 bg-inverse px-2 py-1.5 text-dns-13N-130 text-fg-inverse shadow-1"
      style={below ? { left, top: tip.y + 18, width: W } : { left, bottom: `calc(100% - ${tip.y}px + 8px)`, width: W }}
    >
      {tip.lines.filter(Boolean).map((l, i) => (
        <span key={i} className={i === 0 ? "font-bold tabular-nums" : "break-words"}>
          {l}
        </span>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? "…" + s.slice(-(n - 1)) : s;
}
