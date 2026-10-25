/**
 * デモの再生クロック（00_decisions.md D12、02 §8.1）。DOM に触れない純 TS（時刻源と音声を注入して試験する）。
 *
 * - 区間（step の say）の中は音声の再生位置が主: t = seg.t0 + voice.position()
 * - 区間の外（打鍵だけ・実行の表示・間）は仮想時計: t += dt × rate
 * - 区間の頭では音声が実際に鳴り始めるまで t を止めて待つ（最大 waitLimitMs。超えたらその区間は字幕だけで進める）
 * - 一時停止して再開すると、区間の途中（文の途中）から鳴らし直す
 * - 速度・消音はタイムラインを変えない（音声は playbackRate、ピッチは保つ）
 * 音声が無いデモは segments を空にすれば、全体が仮想時計で進む（字幕のみ、D10）。
 */

export interface VoiceSegment {
  key: string;
  stepId: string;
  t0: number;
  t1: number;
  url: string;
}

export interface VoiceDriver {
  /** これから鳴らす区間を先読みする */
  prepare(segs: VoiceSegment[]): void;
  /** offsetMs から鳴らす。実際に鳴り始めたら resolve、鳴らせなければ reject */
  play(seg: VoiceSegment, offsetMs: number, rate: number): Promise<void>;
  pause(): void;
  stop(): void;
  /** 鳴らしている区間内の位置（ms）。鳴っていなければ null */
  position(): number | null;
  /** 今の区間を最後まで鳴らし終えたか */
  ended(): boolean;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
}

/** 何もしない音声（字幕のみ） */
export const SILENT_VOICE: VoiceDriver = {
  prepare() {},
  play: () => Promise.resolve(),
  pause() {},
  stop() {},
  position: () => null,
  ended: () => true,
  setRate() {},
  setMuted() {},
};

export interface ClockState {
  t: number;
  playing: boolean;
  /** 音声の鳴り始めを待っている（t は止まっている） */
  waiting: boolean;
  rate: number;
  muted: boolean;
  /** 音声を鳴らせず字幕だけで進めた区間の数 */
  voiceFailures: number;
  /** 終端まで再生した */
  ended: boolean;
}

interface Active {
  seg: VoiceSegment;
  status: "starting" | "playing" | "done";
  since: number;
  token: number;
}

export interface DemoClockOptions {
  duration: number;
  segments: VoiceSegment[];
  voice: VoiceDriver;
  now: () => number;
  /** 鳴り始めを待つ上限（02 §8.1: 1.5 秒） */
  waitLimitMs?: number;
  /** 1 フレームで進める仮想時間の上限（タブが裏にあった後に飛ばないように） */
  maxFrameMs?: number;
}

export class DemoClock {
  private readonly duration: number;
  private readonly segments: VoiceSegment[];
  private readonly voice: VoiceDriver;
  private readonly now: () => number;
  private readonly waitLimit: number;
  private readonly maxFrame: number;
  private state: ClockState;
  private active: Active | null = null;
  private last = 0;
  private token = 0;
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(o: DemoClockOptions) {
    this.duration = Math.max(0, o.duration);
    this.segments = [...o.segments].sort((a, b) => a.t0 - b.t0);
    this.voice = o.voice;
    this.now = o.now;
    this.waitLimit = o.waitLimitMs ?? 1500;
    this.maxFrame = o.maxFrameMs ?? 250;
    this.state = { t: 0, playing: false, waiting: false, rate: 1, muted: false, voiceFailures: 0, ended: false };
  }

  getState(): ClockState {
    return this.state;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private set(patch: Partial<ClockState>) {
    const next = { ...this.state, ...patch };
    const changed = (Object.keys(patch) as (keyof ClockState)[]).some((k) => next[k] !== this.state[k]);
    if (!changed) return;
    this.state = next;
    for (const l of this.listeners) l();
  }

  play() {
    if (this.state.playing) return;
    const t = this.state.t >= this.duration ? 0 : this.state.t;
    this.last = this.now();
    this.set({ playing: true, t, ended: false });
  }

  pause() {
    if (!this.state.playing) return;
    // 鳴っていた位置まで t を進めてから止める（再開は文の途中から）
    const pos = this.active?.status === "playing" ? this.voice.position() : null;
    const t = pos != null && this.active ? Math.min(this.duration, this.active.seg.t0 + pos) : this.state.t;
    this.voice.pause();
    this.active = null;
    this.set({ playing: false, waiting: false, t });
  }

  toggle() {
    if (this.state.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    this.voice.stop();
    this.active = null;
    this.last = this.now();
    const nt = Math.min(this.duration, Math.max(0, t));
    this.set({ t: nt, waiting: false, ended: false });
  }

  setRate(rate: number) {
    this.voice.setRate(rate);
    this.set({ rate });
  }

  setMuted(muted: boolean) {
    this.voice.setMuted(muted);
    this.set({ muted });
  }

  /** t を含む区間（字幕だけに落とした区間は除く） */
  private segAt(t: number): VoiceSegment | undefined {
    for (const s of this.segments) {
      if (s.t0 > t) break;
      if (t < s.t1 && !this.failed.has(s.key)) return s;
    }
    return undefined;
  }

  /** (from, to] に頭がある最初の区間 */
  private segStartingIn(from: number, to: number): VoiceSegment | undefined {
    return this.segments.find((s) => s.t0 > from && s.t0 <= to && !this.failed.has(s.key));
  }

  private startVoice(seg: VoiceSegment, offset: number, now: number) {
    const token = ++this.token;
    this.active = { seg, status: "starting", since: now, token };
    const playing = this.voice.play(seg, Math.max(0, offset), this.state.rate);
    // 先読みは鳴らす区間を決めた後（同じ要素に次の区間を読み込まないように）
    const i = this.segments.indexOf(seg);
    this.voice.prepare(this.segments.slice(i + 1, i + 3));
    playing.then(
      () => {
        if (this.active?.token === token && this.active.status === "starting") this.active.status = "playing";
      },
      () => {
        if (this.active?.token === token) this.giveUp(seg);
      },
    );
  }

  private giveUp(seg: VoiceSegment) {
    this.failed.add(seg.key);
    this.voice.stop();
    this.active = null;
    this.last = this.now();
    this.set({ voiceFailures: this.failed.size, waiting: false });
  }

  /** 1 フレーム進める（rAF から呼ぶ） */
  tick(): ClockState {
    const now = this.now();
    const dt = Math.min(this.maxFrame, Math.max(0, now - this.last));
    this.last = now;
    if (!this.state.playing) return this.state;
    let t = this.state.t;
    const a = this.active;

    if (a) {
      if (a.status === "starting") {
        if (now - a.since <= this.waitLimit) {
          this.set({ waiting: true });
          return this.state;
        }
        // 鳴り始めない: この区間は字幕だけで進める
        this.giveUp(a.seg);
      } else if (a.status === "playing") {
        const pos = this.voice.position();
        if (pos != null && !this.voice.ended()) {
          t = a.seg.t0 + pos;
          // 音声が区間より長い（推定と実測のずれ）ときは区間の終わりで打ち切る
          if (t >= a.seg.t1 + 250) {
            this.voice.stop();
            a.status = "done";
            t = a.seg.t1;
          }
          return this.advanceTo(t, false);
        }
        // 鳴り終えた。区間の残り（あれば）は仮想時計で進む
        a.status = "done";
        t = Math.max(t, Math.min(a.seg.t1, a.seg.t0 + (pos ?? a.seg.t1 - a.seg.t0)));
      }
    }

    // 再開・シーク直後で、区間の途中にいる
    const inside = this.segAt(t);
    if (inside && !(this.active && this.active.seg === inside)) {
      this.startVoice(inside, t - inside.t0, now);
      return this.advanceTo(t, true);
    }
    const next = t + dt * this.state.rate;
    const upcoming = this.segStartingIn(t, next);
    if (upcoming) {
      this.startVoice(upcoming, 0, now);
      return this.advanceTo(upcoming.t0, true);
    }
    return this.advanceTo(next, false);
  }

  private advanceTo(t: number, waiting: boolean): ClockState {
    if (t >= this.duration) {
      this.voice.stop();
      this.active = null;
      this.set({ t: this.duration, playing: false, waiting: false, ended: true });
      return this.state;
    }
    this.set({ t, waiting });
    return this.state;
  }
}
