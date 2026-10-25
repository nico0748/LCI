"use client";

import type { Axis } from "@lci/core/browser";
import { StatusBadge, cx } from "@/components/ui";
import { SCORE_BASELINE, SCORE_MAX, SCORE_MIN, dotBarX, type AxisRow } from "./review-model";

/**
 * 軸別スコアの横向きドットバー（X7: 8 軸レーダーの代わり、04 §2）。
 * - 尺度 1–5、縦線が標準の 3。並びは AXES の固定順（得点順に並べ替えない）
 * - 重みを文字で出す（面積で総合点を示唆しない）
 * - 「次の練習」の対象軸だけ accent、他は無彩色。確信度が低い（推測）軸は中抜きの点＋「推測」
 * - 行を押すと下の「軸別の根拠」の該当項目を開く
 */
const BAR_W = 168;
const BAR_H = 20;
const PAD = 7;

export function AxisDotBars({ rows, onOpenAxis }: { rows: AxisRow[]; onOpenAxis: (a: Axis) => void }) {
  const ticks = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[2.75rem_168px_1.5rem] items-end gap-x-2 px-2 text-dns-13N-130 text-fg-muted desktop:grid-cols-[minmax(0,1fr)_2.75rem_168px_1.5rem]" aria-hidden="true">
        <span className="hidden desktop:inline">軸</span>
        <span className="text-right">重み</span>
        <svg width={BAR_W} height={14} className="block">
          {ticks.map((v) => (
            <text key={v} x={dotBarX(v, BAR_W, PAD)} y={11} textAnchor="middle" fill="var(--fg-muted)" style={{ font: "400 12px/1 var(--font-mono)" }}>
              {v}
            </text>
          ))}
        </svg>
        <span className="text-right">点</span>
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const color = r.practice ? "var(--accent)" : "var(--fg-muted)";
          const x0 = dotBarX(SCORE_MIN, BAR_W, PAD);
          const xs = dotBarX(r.score, BAR_W, PAD);
          const xb = dotBarX(SCORE_BASELINE, BAR_W, PAD);
          const name = `${r.label} ${r.score} / 5、重み ${r.weightPct}%、確信度 ${Math.round(r.confidence * 100)}%${r.speculative ? "、推測" : ""}${r.practice ? "、次の練習の対象" : ""}`;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpenAxis(r.id)}
                aria-label={`${name}。根拠を開く`}
                className="grid w-full grid-cols-[2.75rem_168px_1.5rem] items-center gap-x-2 gap-y-0.5 rounded-4 px-2 py-1 text-left focus-ring-inset can-hover:bg-hover desktop:grid-cols-[minmax(0,1fr)_2.75rem_168px_1.5rem]"
              >
                <span className="col-span-3 flex min-w-0 items-center gap-1.5 desktop:col-span-1">
                  <span className={cx("truncate text-dns-14N-130", r.practice ? "text-fg" : "text-fg-body")}>{r.label}</span>
                  {r.speculative && (
                    <StatusBadge variant="outlined">
                      推測
                    </StatusBadge>
                  )}
                </span>
                <span className="text-right text-mono-12N-120 text-fg-muted">{r.weightPct}%</span>
                <svg width={BAR_W} height={BAR_H} className="block" aria-hidden="true">
                  {/* 1–5 の軸（recessive） */}
                  <line x1={x0} x2={dotBarX(SCORE_MAX, BAR_W, PAD)} y1={BAR_H / 2} y2={BAR_H / 2} stroke="var(--border-subtle)" strokeWidth={2} strokeLinecap="round" />
                  {/* 標準 3 の縦線 */}
                  <line x1={xb} x2={xb} y1={1} y2={BAR_H - 1} stroke="var(--border-strong)" strokeWidth={1} />
                  {/* 1 から得点までの棒 */}
                  {xs > x0 && <line x1={x0} x2={xs} y1={BAR_H / 2} y2={BAR_H / 2} stroke={color} strokeWidth={2} strokeLinecap="round" />}
                  {/* 得点の点。推測は中抜き。面の色のリングで縦線と重なっても読めるように */}
                  <circle cx={xs} cy={BAR_H / 2} r={6} fill="var(--bg-surface)" />
                  <circle cx={xs} cy={BAR_H / 2} r={r.speculative ? 3.75 : 4.5} fill={r.speculative ? "var(--bg-surface)" : color} stroke={color} strokeWidth={r.speculative ? 2 : 0} />
                </svg>
                <span className={cx("text-right text-mono-14N-150", r.practice ? "text-fg font-bold" : "text-fg-body")}>{r.score}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-1 text-dns-13N-130 text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block h-3 w-px bg-border-strong" />
          標準（3）
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
          次の練習の対象
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block size-2 rounded-full border-2 border-fg-muted" />
          推測（確信度が低い・根拠なし）
        </span>
      </p>
    </div>
  );
}
