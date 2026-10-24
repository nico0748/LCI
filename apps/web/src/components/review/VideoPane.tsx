"use client";

import { useEffect, useRef, useState } from "react";
import type { Recorder } from "@lci/core/browser";
import { mediaToT, tToMedia } from "./time";

/**
 * 動画ペイン。cam を主（音声つき）とし、screen があれば同期させて並べる。
 * 時刻の主キーはセッション時計 t。video.currentTime ↔ t は recorder の t_rec_start / scale で写像する（D6）。
 * - 親からの seek は `seekVersion` の変化でだけ反映する（再生中の t 更新で毎フレーム seek しないため）。
 * - 再生中は rAF で t を親に報告する（timeupdate は 250ms 粒度で粗い）。
 */
export function VideoPane({
  sessionId,
  recorders,
  t,
  seekVersion,
  playing,
  onTime,
  onPlayingChange,
  onMediaAvailable,
}: {
  sessionId: string;
  recorders: Recorder[];
  t: number;
  seekVersion: number;
  playing: boolean;
  onTime: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onMediaAvailable: (ok: boolean) => void;
}) {
  const cam = recorders.find((r) => r.id === "cam");
  const screen = recorders.find((r) => r.id === "screen");
  const primary = cam ?? screen;
  const secondary = cam && screen ? screen : undefined;
  const primaryRef = useRef<HTMLVideoElement>(null);
  const secondaryRef = useRef<HTMLVideoElement>(null);
  const [primaryOk, setPrimaryOk] = useState(!!primary);
  const [secondaryOk, setSecondaryOk] = useState(!!secondary);
  const [large, setLarge] = useState<"primary" | "secondary">("primary");
  const tRef = useRef(t);
  tRef.current = t;
  const lastReported = useRef(-1);

  useEffect(() => {
    onMediaAvailable(primaryOk && !!primary);
  }, [primaryOk, primary, onMediaAvailable]);

  // 親からの seek
  useEffect(() => {
    const tt = tRef.current;
    const v = primaryRef.current;
    if (v && primary) {
      const ms = tToMedia(tt, primary);
      if (Math.abs(v.currentTime * 1000 - ms) > 120) v.currentTime = ms / 1000;
    }
    const s = secondaryRef.current;
    if (s && secondary) {
      const ms = tToMedia(tt, secondary);
      if (Math.abs(s.currentTime * 1000 - ms) > 120) s.currentTime = ms / 1000;
    }
    // seekVersion が変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion]);

  // 再生・停止
  useEffect(() => {
    const v = primaryRef.current;
    const s = secondaryRef.current;
    if (playing) {
      v?.play().catch(() => onPlayingChange(false));
      s?.play().catch(() => undefined);
    } else {
      v?.pause();
      s?.pause();
    }
  }, [playing, onPlayingChange]);

  // 再生中の時刻報告と screen のドリフト補正
  useEffect(() => {
    if (!playing || !primaryOk || !primary) return;
    let raf = 0;
    const tick = () => {
      const v = primaryRef.current;
      if (v) {
        const now = mediaToT(v.currentTime * 1000, primary);
        if (Math.abs(now - lastReported.current) >= 80) {
          lastReported.current = now;
          onTime(now);
        }
        const s = secondaryRef.current;
        if (s && secondary && secondaryOk) {
          const want = tToMedia(now, secondary) / 1000;
          if (Math.abs(s.currentTime - want) > 0.3) s.currentTime = want;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, primaryOk, primary, secondary, secondaryOk, onTime]);

  if (!primary) {
    return (
      <div className="aspect-video rounded-lg border border-border bg-bg-elev grid place-items-center text-sm text-fg-muted">
        録画がありません（カメラ OFF で開始したセッション）
      </div>
    );
  }

  const src = (r: Recorder) => `/api/sessions/${encodeURIComponent(sessionId)}/media/${r.id}`;
  const videoCls = "w-full h-full object-contain bg-black";

  const primaryEl = (
    <video
      ref={primaryRef}
      src={src(primary)}
      className={videoCls}
      controls
      playsInline
      preload="metadata"
      onPlay={() => onPlayingChange(true)}
      onPause={() => onPlayingChange(false)}
      onEnded={() => onPlayingChange(false)}
      onSeeking={() => {
        const v = primaryRef.current;
        if (v) onTime(mediaToT(v.currentTime * 1000, primary));
      }}
      onLoadedMetadata={() => {
        const v = primaryRef.current;
        if (v) v.currentTime = tToMedia(tRef.current, primary) / 1000;
      }}
      onError={() => setPrimaryOk(false)}
      aria-label={primary.id === "cam" ? "カメラ映像" : "画面収録"}
    />
  );
  const secondaryEl = secondary ? (
    <video ref={secondaryRef} src={src(secondary)} className={videoCls} muted playsInline preload="metadata" onError={() => setSecondaryOk(false)} aria-label="画面収録" />
  ) : null;

  if (!primaryOk) {
    return (
      <div className="aspect-video rounded-lg border border-border bg-bg-elev grid place-items-center text-sm text-fg-muted p-4 text-center">
        動画を読み込めませんでした。{primary.file} が無いか、再 mux 前の録画です。タイムラインと文字起こしだけで振り返れます。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-black">
        <div className={large === "primary" ? "absolute inset-0" : "absolute right-2 bottom-2 w-1/3 aspect-video rounded overflow-hidden border border-border shadow"}>{primaryEl}</div>
        {secondaryEl && secondaryOk && (
          <div className={large === "secondary" ? "absolute inset-0" : "absolute right-2 bottom-2 w-1/3 aspect-video rounded overflow-hidden border border-border shadow"}>{secondaryEl}</div>
        )}
      </div>
      {secondary && secondaryOk && (
        <div className="flex items-center justify-end gap-2 text-xs text-fg-muted">
          <span>大きく表示:</span>
          <button type="button" onClick={() => setLarge("primary")} className={`rounded border px-2 py-0.5 ${large === "primary" ? "border-accent text-fg" : "border-border"}`}>
            カメラ
          </button>
          <button type="button" onClick={() => setLarge("secondary")} className={`rounded border px-2 py-0.5 ${large === "secondary" ? "border-accent text-fg" : "border-border"}`}>
            画面
          </button>
        </div>
      )}
    </div>
  );
}
