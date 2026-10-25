"use client";

import { useEffect, useRef, useState } from "react";
import type { Recorder } from "@lci/core/browser";
import { Button, cx } from "@/components/ui";
import { mediaToT, tToMedia } from "./time";

/**
 * 動画ペイン。cam を主（音声つき）とし、screen があれば同期させて小窓に重ねる。
 * 時刻の主キーはセッション時計 t。video.currentTime ↔ t は recorder の t_rec_start / scale で写像する（D6）。
 * - <video controls> は出さない。再生操作はトランスポート 1 か所にまとめる（S2-6 の二重操作をやめる）
 * - 親からの seek は `seekVersion` の変化でだけ反映する（再生中の t 更新で毎フレーム seek しないため）
 * - 再生中は rAF で t を親に報告する（timeupdate は 250ms 粒度で粗い）
 * - 録画が無い・読めないときは 16:9 の空枠を出さず、1 行の注記にする（04 §4.1）
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
  className,
}: {
  sessionId: string;
  recorders: Recorder[];
  t: number;
  seekVersion: number;
  playing: boolean;
  onTime: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onMediaAvailable: (ok: boolean) => void;
  className?: string;
}) {
  const cam = recorders.find((r) => r.id === "cam");
  const screen = recorders.find((r) => r.id === "screen");
  const primary = cam ?? screen;
  const secondary = cam && screen ? screen : undefined;
  const primaryRef = useRef<HTMLVideoElement>(null);
  const secondaryRef = useRef<HTMLVideoElement>(null);
  const [primaryOk, setPrimaryOk] = useState(true);
  const [secondaryOk, setSecondaryOk] = useState(true);
  const [large, setLarge] = useState<"primary" | "secondary">("primary");
  const tRef = useRef(t);
  const lastReported = useRef(-1);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    onMediaAvailable(primaryOk && !!primary);
  }, [primaryOk, primary, onMediaAvailable]);

  // 水和より前に読み込みが失敗していると onError が届かないので、マウント時に error を見直す
  useEffect(() => {
    const timer = setTimeout(() => {
      if (primaryRef.current?.error) setPrimaryOk(false);
      if (secondaryRef.current?.error) setSecondaryOk(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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

  if (!primary || !primaryOk) {
    return (
      <p className={cx("rounded-8 border border-border bg-surface px-3 py-2 text-dns-14N-130 text-fg-muted max-xl:py-1.5", className)}>
        {/* モバイルの sticky プレイヤーでは高さを取らないよう 1 行に縮める */}
        <span className="xl:hidden">{!primary ? "録画はありません。" : "動画を読み込めませんでした。"}</span>
        <span className="hidden xl:inline">
          {!primary ? "録画はありません（カメラを使わずに始めたセッション）。" : "動画を読み込めませんでした（再 mux 前の録画か、ファイルがありません）。"}
          タイムラインと文字起こしで振り返れます。
        </span>
      </p>
    );
  }

  const src = (r: Recorder) => `/api/sessions/${encodeURIComponent(sessionId)}/media/${r.id}`;
  const videoCls = "h-full w-full bg-black object-contain";
  const inset = "absolute right-2 bottom-2 w-1/3 aspect-video overflow-hidden rounded-4 border border-border";
  const toggle = () => onPlayingChange(!playing);

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="relative aspect-video overflow-hidden rounded-8 border border-border bg-black">
        <div className={large === "primary" ? "absolute inset-0" : inset}>
          <video
            ref={primaryRef}
            src={src(primary)}
            className={videoCls}
            playsInline
            preload="metadata"
            onClick={toggle}
            onPlay={() => onPlayingChange(true)}
            onPause={() => onPlayingChange(false)}
            onEnded={() => onPlayingChange(false)}
            onLoadedMetadata={() => {
              const v = primaryRef.current;
              if (v) v.currentTime = tToMedia(tRef.current, primary) / 1000;
            }}
            onError={() => setPrimaryOk(false)}
            aria-label={primary.id === "cam" ? "カメラ映像（再生はタイムライン上の操作で行う）" : "画面収録"}
          />
        </div>
        {secondary && secondaryOk && (
          <div className={large === "secondary" ? "absolute inset-0" : inset}>
            <video ref={secondaryRef} src={src(secondary)} className={videoCls} muted playsInline preload="metadata" onClick={toggle} onError={() => setSecondaryOk(false)} aria-label="画面収録" />
          </div>
        )}
      </div>
      {secondary && secondaryOk && (
        <div className="flex items-center justify-end gap-2 text-dns-13N-130 text-fg-muted" role="group" aria-label="大きく表示する映像">
          <Button size="2xs" aria-pressed={large === "primary"} onClick={() => setLarge("primary")} className="aria-pressed:border-accent aria-pressed:bg-selected">
            カメラ
          </Button>
          <Button size="2xs" aria-pressed={large === "secondary"} onClick={() => setLarge("secondary")} className="aria-pressed:border-accent aria-pressed:bg-selected">
            画面
          </Button>
        </div>
      )}
    </div>
  );
}
