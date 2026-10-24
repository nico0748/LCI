"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtT, type Session, type Transcript } from "@lci/core/browser";
import { indexAtOrBefore } from "./time";

/**
 * 同期文字起こし。現在の t を含むセグメントを強調し、クリックで seek する。
 * 無音セグメントは行として読ませず、長さに応じた細い灰色バーにする。
 */
export function TranscriptPane({
  transcript,
  stt,
  status,
  t,
  onSeek,
  highlight,
}: {
  transcript: Transcript | null;
  stt: Session["stt"];
  status: Session["status"];
  t: number;
  onSeek: (t: number) => void;
  highlight: { t0: number; t1: number } | null;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);
  const segments = useMemo(() => transcript?.segments ?? [], [transcript]);
  const currentIdx = useMemo(() => {
    const i = indexAtOrBefore(segments, t, (s) => s.t_start);
    if (i < 0) return -1;
    return segments[i]!.t_end >= t ? i : -1;
  }, [segments, t]);

  // 自動スクロール（ユーザーがリストにマウスを置いている間は追従しない）
  useEffect(() => {
    if (!follow || currentIdx < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${currentIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [currentIdx, follow]);

  if (!transcript) {
    const skipped = stt?.status === "skipped" || stt?.status === "failed";
    return (
      <div className="rounded-lg border border-border bg-bg-elev p-4 text-sm text-fg-muted space-y-2">
        {skipped ? (
          <>
            <p>文字起こしは{stt?.status === "failed" ? "失敗しました" : "スキップされました"}。{stt?.error && <span className="font-mono text-xs"> {stt.error}</span>}</p>
            <p className="text-xs leading-relaxed">
              whisper.cpp を用意し、<code className="font-mono">.env.local</code> に <code className="font-mono">LCI_WHISPER_BIN</code>（既定 <code className="font-mono">whisper-cli</code>）と{" "}
              <code className="font-mono">LCI_WHISPER_MODEL</code>（ggml-large-v3-turbo のパス）を設定すると、次回以降のセッションで文字起こしが有効になります。
            </p>
          </>
        ) : status === "ready" || status === "failed" ? (
          <p>文字起こしがありません。</p>
        ) : (
          <p>文字起こしを待っています（{status}）…</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elev flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-xs text-fg-muted">
        <span>文字起こし · {segments.filter((s) => s.text.trim()).length} 発話</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 追従
        </label>
      </div>
      <ol ref={listRef} className="overflow-y-auto max-h-[40vh] xl:max-h-[calc(100vh-520px)] min-h-40 px-2 py-1" onMouseEnter={() => setFollow(false)} onMouseLeave={() => setFollow(true)}>
        {segments.map((s, i) => {
          const silent = !s.text.trim();
          const isCur = i === currentIdx;
          const inHl = highlight && s.t_start < highlight.t1 && s.t_end > highlight.t0;
          if (silent) {
            const dur = Math.max(0, s.t_end - s.t_start);
            const w = Math.min(100, Math.max(4, (dur / 60_000) * 100));
            return (
              <li key={s.id} data-idx={i} className="py-0.5">
                <button type="button" onClick={() => onSeek(s.t_start)} className="w-full flex items-center gap-2 text-left group" title={`無音 ${(dur / 1000).toFixed(0)} 秒 · ${fmtT(s.t_start)}`}>
                  <span className="font-mono text-[10px] text-fg-muted w-10 shrink-0">{fmtT(s.t_start)}</span>
                  <span className={`h-1 rounded-full ${isCur ? "bg-fg-muted" : "bg-border group-hover:bg-fg-muted"}`} style={{ width: `${w}%` }} />
                  {dur >= 15_000 && <span className="text-[10px] text-fg-muted">{(dur / 1000).toFixed(0)}s</span>}
                </button>
              </li>
            );
          }
          return (
            <li key={s.id} data-idx={i}>
              <button
                type="button"
                onClick={() => onSeek(s.t_start)}
                className={`w-full text-left flex gap-2 rounded px-1.5 py-1 text-sm leading-relaxed hover:bg-bg ${isCur ? "bg-bg outline outline-1 -outline-offset-1 outline-accent/60" : ""} ${inHl ? "bg-warn/10" : ""}`}
                aria-current={isCur ? "true" : undefined}
              >
                <span className="font-mono text-[11px] text-fg-muted w-10 shrink-0 pt-0.5">{fmtT(s.t_start)}</span>
                <span className={s.is_filler ? "text-fg-muted" : ""}>{s.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
