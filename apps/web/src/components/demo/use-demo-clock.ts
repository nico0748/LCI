"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { DemoClock, SILENT_VOICE, type ClockState, type VoiceDriver, type VoiceSegment } from "./demo-clock.ts";

/**
 * 区間ファイル（m4a）を <audio> 2 本のプールで鳴らす（02 §8.1 AudioFileVoice）。
 * 1 本で鳴らしている間に、もう 1 本で次の区間を先読みする。速度は playbackRate（ピッチは保つ）。
 * 要素はブラウザで初めて使うときに作る（SSR で Audio を作らない）。
 */
export class AudioFileVoice implements VoiceDriver {
  private els: HTMLAudioElement[] = [];
  private cur: HTMLAudioElement | null = null;
  private rate = 1;
  private muted = false;
  private token = 0;

  private pool(): HTMLAudioElement[] {
    if (!this.els.length && typeof Audio !== "undefined") {
      this.els = [new Audio(), new Audio()];
      for (const el of this.els) {
        el.preload = "auto";
        el.preservesPitch = true;
        el.muted = this.muted;
      }
    }
    return this.els;
  }

  private load(el: HTMLAudioElement, seg: VoiceSegment) {
    if (el.dataset.key === seg.key) return;
    el.dataset.key = seg.key;
    el.src = seg.url;
    el.load();
  }

  prepare(segs: VoiceSegment[]) {
    const next = segs[0];
    if (!next) return;
    const els = this.pool();
    if (els.some((e) => e.dataset.key === next.key)) return;
    const idle = els.find((e) => e !== this.cur);
    if (idle) this.load(idle, next);
  }

  async play(seg: VoiceSegment, offsetMs: number, rate: number): Promise<void> {
    const els = this.pool();
    if (!els.length) throw new Error("audio unavailable");
    const token = ++this.token;
    const el = els.find((e) => e.dataset.key === seg.key) ?? els.find((e) => e !== this.cur) ?? els[0]!;
    if (this.cur && this.cur !== el) this.cur.pause();
    this.cur = el;
    this.load(el, seg);
    el.playbackRate = rate;
    el.preservesPitch = true;
    el.muted = this.muted;
    if (el.readyState < 1) {
      await new Promise<void>((resolve, reject) => {
        const ok = () => {
          cleanup();
          resolve();
        };
        const ng = () => {
          cleanup();
          reject(new Error("audio load failed"));
        };
        const cleanup = () => {
          el.removeEventListener("loadedmetadata", ok);
          el.removeEventListener("error", ng);
        };
        el.addEventListener("loadedmetadata", ok);
        el.addEventListener("error", ng);
      });
    }
    if (token !== this.token) return;
    el.currentTime = Math.max(0, offsetMs / 1000);
    await el.play();
    // 待っている間に止められた（シーク・一時停止）なら鳴らさない
    if (token !== this.token || this.cur !== el) el.pause();
  }

  pause() {
    this.token++;
    this.cur?.pause();
  }

  stop() {
    this.token++;
    this.cur?.pause();
    this.cur = null;
  }

  position(): number | null {
    const el = this.cur;
    if (!el || (el.paused && !el.ended)) return null;
    return el.currentTime * 1000;
  }

  ended(): boolean {
    return !!this.cur && this.cur.ended;
  }

  setRate(rate: number) {
    this.rate = rate;
    for (const el of this.els) el.playbackRate = rate;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    for (const el of this.els) el.muted = muted;
  }

  dispose() {
    this.token++;
    for (const el of this.els) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.els = [];
    this.cur = null;
  }
}

/** 壁時計（ミリ秒）。clock が tick・再生・停止のときにだけ呼ぶ */
const perfNow = () => performance.now();

/**
 * DemoClock を React から使う。rAF で tick し、状態は useSyncExternalStore で読む。
 * segments が空なら音声なし（字幕のみ）。
 */
export function useDemoClock({ duration, segments, initialT = 0, rate = 1, muted = false }: { duration: number; segments: VoiceSegment[]; initialT?: number; rate?: number; muted?: boolean }) {
  const voice = useMemo<VoiceDriver & { dispose?: () => void }>(() => (segments.length ? new AudioFileVoice() : SILENT_VOICE), [segments]);
  const clock = useMemo(() => {
    const c = new DemoClock({ duration, segments, voice, now: perfNow });
    c.seek(initialT);
    c.setRate(rate);
    c.setMuted(muted);
    return c;
    // 速度・消音・初期位置は作り直すときだけ引き継ぐ（変更は clock のメソッドで伝える）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, segments, voice]);

  useEffect(() => () => voice.dispose?.(), [voice]);
  useEffect(() => () => clock.pause(), [clock]);

  const subscribe = useCallback((cb: () => void) => clock.subscribe(cb), [clock]);
  const get = useCallback(() => clock.getState(), [clock]);
  const state: ClockState = useSyncExternalStore(subscribe, get, get);

  useEffect(() => {
    if (!state.playing) return;
    let raf = 0;
    const loop = () => {
      clock.tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clock, state.playing]);

  return { clock, state };
}
