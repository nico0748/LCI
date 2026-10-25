"use client";

import type { Axis, ProblemMeta } from "@lci/core/browser";
import type { CompiledDemo } from "@lci/demo/browser";
import { cx } from "@/components/ui";
import { AXIS_SHORT, fmtT } from "./demo-model.ts";
import { CheckGlyph } from "./parts.tsx";

/**
 * 章の一覧と話すべきポイント（FR-D-16）。章は開始時刻と手本になる軸を出し、押すとその章の頭へ移動する。
 * ポイントの ✓ は再生位置までに触れたものだけに付け、触れた時刻を押すとそこへ移動する（✓ は無彩色、01 §7）。
 */
export function ChapterList({
  chapters,
  currentIndex,
  t,
  talkingPoints,
  coverage,
  onSeekChapter,
  onSeek,
  className,
}: {
  chapters: CompiledDemo["chapters"];
  currentIndex: number;
  t: number;
  talkingPoints: ProblemMeta["talking_points"];
  coverage: Map<string, number>;
  onSeekChapter: (index: number) => void;
  onSeek: (t: number) => void;
  className?: string;
}) {
  const covered = talkingPoints.filter((p) => {
    const at = coverage.get(p.id);
    return at != null && at <= t;
  }).length;
  return (
    <div className={cx("flex min-h-0 flex-col overflow-y-auto", className)}>
      <h3 className="sr-only">章</h3>
      <ol className="flex flex-col py-1" aria-label="章の一覧（押すとその章の頭へ移動）">
        {chapters.map((c, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSeekChapter(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={cx(
                  "grid w-full grid-cols-[1.25rem_1fr_auto] items-start gap-x-2 rounded-4 px-2 py-1.5 text-left focus-ring-inset",
                  state === "current" ? "bg-selected shadow-[inset_2px_0_0_var(--accent)]" : "can-hover:bg-hover",
                )}
              >
                <span aria-hidden className="pt-px text-dns-14N-130 text-fg-muted">
                  {state === "done" ? "✓" : state === "current" ? "▶" : "○"}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cx("text-dns-14N-130", state === "current" ? "text-fg" : "text-fg-body")}>
                    <span className="text-mono-12N-120 text-fg-muted">{i + 1}</span> {c.title}
                    <span className="sr-only">{state === "done" ? "（見た）" : state === "current" ? "（再生中）" : ""}</span>
                  </span>
                  {c.axes.length > 0 && <span className="text-dns-13N-130 text-fg-muted">{c.axes.map((a) => AXIS_SHORT[a as Axis] ?? a).join("・")}</span>}
                </span>
                <span className="pt-px text-mono-12N-120 text-fg-muted">{fmtT(c.t0)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {talkingPoints.length > 0 && (
        <section aria-labelledby="demo-tp-h" className="mt-1 flex flex-col gap-1 border-t border-border-subtle px-2 pt-3 pb-2">
          <h3 id="demo-tp-h" className="text-dns-14B-130 text-fg">
            話すべきポイント{" "}
            <span className="text-dns-13N-130 font-normal text-fg-muted tabular-nums">
              {covered}/{talkingPoints.length}
            </span>
          </h3>
          <ul className="flex flex-col">
            {talkingPoints.map((p) => {
              const at = coverage.get(p.id);
              const on = at != null && at <= t;
              return (
                <li key={p.id} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-x-2 py-1">
                  <span className="pt-[3px]">
                    <CheckGlyph on={on} />
                  </span>
                  <span className={cx("text-std-14N-170", on ? "text-fg-body" : "text-fg-muted")}>
                    {p.text}
                    <span className="sr-only">{on ? "（触れた）" : "（まだ）"}</span>
                  </span>
                  {on ? (
                    <button type="button" onClick={() => onSeek(at)} className="min-h-6 rounded-4 px-1 text-mono-12N-120 text-link underline underline-offset-[3px] focus-text" aria-label={`${fmtT(at)} へ移動`}>
                      {fmtT(at)}
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
