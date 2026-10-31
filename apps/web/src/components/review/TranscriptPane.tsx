"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fmtT, type Session, type Transcript } from "@lci/core/browser";
import { Switch, cx } from "@/components/ui";
import { indexAtOrBefore } from "./time";

/**
 * 同期文字起こし。現在の t を含む発話を選択色（--bg-selected）で示し、クリックで seek する。
 * 根拠として選ばれた範囲は --bg-hl-line（黄は使わない、X3）。
 * 無音セグメントは行として読ませず、長さに応じた細い棒にする。15 秒超は「沈黙 140 秒」と文字でも出す。
 * 追従はリスト内だけをスクロールする（ページ全体は動かさない）。マウスを置いている間は追従を止める。
 * 見出し・件数の語・本文の描き方は引数で変えられる（模範解答デモの「字幕の全文」で使う）。
 */
export function TranscriptPane({
  transcript,
  stt,
  status,
  t,
  onSeek,
  highlight,
  className,
  title = "文字起こし",
  countLabel = "発話",
  renderText,
}: {
  transcript: Transcript | null;
  stt: Session["stt"];
  status: Session["status"];
  t: number;
  onSeek: (t: number) => void;
  highlight: { t0: number; t1: number } | null;
  className?: string;
  /** 見出し（既定「文字起こし」） */
  title?: string;
  /** 件数の語（既定「発話」） */
  countLabel?: string;
  /** 本文の描き方（既定は文字列のまま） */
  renderText?: (text: string) => ReactNode;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);
  const [hovering, setHovering] = useState(false);
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const spoken = useMemo(() => segments.filter((s) => s.text.trim()).length, [segments]);
  const currentIdx = useMemo(() => {
    const i = indexAtOrBefore(segments, t, (s) => s.t_start);
    if (i < 0) return -1;
    return segments[i]!.t_end >= t ? i : -1;
  }, [segments, t]);
  const hlIdx = useMemo(() => (highlight ? segments.findIndex((s) => s.t_start < highlight.t1 && s.t_end > highlight.t0) : -1), [segments, highlight]);

  // 追従（リストの中だけをスクロールする）
  useEffect(() => {
    const target = hlIdx >= 0 ? hlIdx : currentIdx;
    if (!follow || hovering || target < 0) return;
    const box = listRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-idx="${target}"]`);
    if (!box || !el) return;
    // ol は relative なので offsetTop はリスト内の位置
    const top = el.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
  }, [currentIdx, hlIdx, follow, hovering]);

  const frame = cx("flex min-h-0 flex-col overflow-hidden rounded-8 border border-border bg-surface", className);

  if (!transcript) {
    const skipped = stt?.status === "skipped" || stt?.status === "failed";
    return (
      <div className={frame}>
        <h3 className="border-b border-border px-3 py-2 text-dns-14B-130 text-fg">{title}</h3>
        <div className="flex flex-col gap-2 overflow-auto p-3 text-std-14N-170 text-fg-muted">
          {skipped ? (
            <>
              <p>
                文字起こしは{stt?.status === "failed" ? "失敗しました" : "スキップされました"}。{stt?.error && <span className="text-mono-13N-150"> {stt.error}</span>}
              </p>
              <p>
                whisper.cpp を用意し、<code className="text-mono-13N-150">.env.local</code> に <code className="text-mono-13N-150">LCI_WHISPER_BIN</code> と{" "}
                <code className="text-mono-13N-150">LCI_WHISPER_MODEL</code> を設定すると、次のセッションから文字起こしされます。
              </p>
            </>
          ) : status === "ready" || status === "failed" ? (
            <p>文字起こしがありません。</p>
          ) : (
            <p role="status">文字起こしを待っています（{status}）…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border px-3 py-1">
        <h3 className="text-dns-14B-130 text-fg">
          {title} <span className="text-dns-13N-130 font-normal text-fg-muted tabular-nums">{spoken} {countLabel}</span>
        </h3>
        <Switch checked={follow} onCheckedChange={setFollow} className="text-dns-13N-130 text-fg-muted">
          再生に追従
        </Switch>
      </div>
      <ol
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-1.5 py-1"
        aria-label={`${countLabel}の一覧（押すとその時刻へ移動）`}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
      >
        {segments.map((s, i) => {
          const silent = !s.text.trim();
          const isCur = i === currentIdx;
          const inHl = !!highlight && s.t_start < highlight.t1 && s.t_end > highlight.t0;
          if (silent) {
            const dur = Math.max(0, s.t_end - s.t_start);
            const long = dur >= 15_000;
            const w = Math.min(100, Math.max(6, (dur / 120_000) * 100));
            return (
              <li key={s.id} data-idx={i}>
                <button
                  type="button"
                  onClick={() => onSeek(s.t_start)}
                  aria-current={isCur ? "true" : undefined}
                  className={cx("group flex w-full items-center gap-2 rounded-4 px-1.5 py-1 text-left focus-ring-inset can-hover:bg-hover", isCur && "bg-selected shadow-[inset_2px_0_0_var(--accent)]")}
                  aria-label={`${fmtT(s.t_start)} 無音 ${Math.round(dur / 1000)} 秒`}
                >
                  <span className="w-11 shrink-0 text-mono-12N-120 text-fg-muted">{fmtT(s.t_start)}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {/* 選択行（bg-selected）の上では viz-neutral が 3:1 に届かないので border-strong にする */}
                    <span aria-hidden className={cx("h-1 rounded-full", isCur ? "bg-border-strong" : "bg-viz-neutral")} style={{ width: `${w}%` }} />
                    {long && <span className="shrink-0 text-dns-13N-130 text-fg-muted tabular-nums">沈黙 {Math.round(dur / 1000)} 秒</span>}
                  </span>
                </button>
              </li>
            );
          }
          return (
            <li key={s.id} data-idx={i}>
              <button
                type="button"
                onClick={() => onSeek(s.t_start)}
                className={cx(
                  "flex w-full gap-2 rounded-4 px-1.5 py-1 text-left focus-ring-inset",
                  inHl ? "bg-hl-line" : isCur ? "bg-selected" : "can-hover:bg-hover",
                  (isCur || inHl) && "shadow-[inset_2px_0_0_var(--accent)]",
                )}
                aria-current={isCur ? "true" : undefined}
              >
                <span className={cx("w-11 shrink-0 pt-[3px] text-mono-12N-120", inHl ? "text-fg-body" : "text-fg-muted")}>{fmtT(s.t_start)}</span>
                <span className={cx("min-w-0 text-std-14N-170", s.is_filler && !inHl ? "text-fg-muted" : "text-fg-body")}>
                  {renderText ? renderText(s.text) : s.text}
                  {inHl && <span className="sr-only">（選んだ根拠の範囲）</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
