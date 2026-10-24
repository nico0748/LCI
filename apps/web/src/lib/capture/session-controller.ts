import type { Recorder, RunResult } from "@lci/core";
import { createClock, type SessionClock } from "./clock.ts";
import { EventLogger, MemoryPendingStorage, fetchSink, type PendingStorage } from "./event-logger.ts";
import { IdbPendingStorage, idbAvailable } from "./idb.ts";
import { CaptureRecorder, type RecorderStatus } from "./recorder.ts";

/**
 * S3 画面のキャプチャ一式（時計・イベントログ・録画）のライフサイクル。React から切り離して置く。
 *
 * t=0 は「問題を表示して開始」を押した瞬間（01 §6.2: 問題表示と録画開始を同一操作に）。
 * その壁時計を localStorage と session.json（/start の started_at_wall）に残し、
 * リロード時は壁時計の差分で原点を復元する（clock.recoveredOrigin）。
 */

const ORIGIN_KEY = (id: string) => `lci-session-origin:${id}`;

export interface StoredOrigin {
  wall: number;
  /** リロードで録画をやり直した回数（ファイル名の接尾辞に使う） */
  restarts: number;
}

export function readStoredOrigin(sessionId: string): StoredOrigin | null {
  try {
    const raw = localStorage.getItem(ORIGIN_KEY(sessionId));
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredOrigin;
    return typeof v.wall === "number" ? v : null;
  } catch {
    return null;
  }
}

function writeStoredOrigin(sessionId: string, v: StoredOrigin) {
  try {
    localStorage.setItem(ORIGIN_KEY(sessionId), JSON.stringify(v));
  } catch {
    /* プライベートモード等。復旧精度が落ちるだけ */
  }
}

export function clearStoredOrigin(sessionId: string) {
  try {
    localStorage.removeItem(ORIGIN_KEY(sessionId));
  } catch {
    /* ignore */
  }
}

export interface ControllerOptions {
  sessionId: string;
  record: { camera: boolean; screen: boolean; enabled: boolean };
  deviceIds?: { audio?: string; video?: string };
  onRecorderStatus?: (s: RecorderStatus[]) => void;
  onWarning?: (code: string, detail?: string) => void;
}

export class SessionController {
  readonly sessionId: string;
  clock!: SessionClock;
  logger!: EventLogger;
  recorder: CaptureRecorder | null = null;
  recorders: Recorder[] = [];
  warnings: { t: number; code: string; detail?: string }[] = [];
  resumed = false;
  private unhookPage: (() => void) | null = null;
  private readonly opts: ControllerOptions;
  private ended = false;

  constructor(opts: ControllerOptions) {
    this.opts = opts;
    this.sessionId = opts.sessionId;
  }

  /**
   * 開始（初回）または再開（リロード後）。ユーザ操作のハンドラ内から呼ぶこと（getDisplayMedia に必要）。
   */
  async begin(): Promise<void> {
    const stored = readStoredOrigin(this.sessionId);
    const nowPerf = performance.now();
    const wallNow = Date.now();
    this.resumed = !!stored;
    const origin = stored ? nowPerf - Math.max(0, wallNow - stored.wall) : nowPerf;
    const restarts = stored ? stored.restarts + 1 : 0;
    writeStoredOrigin(this.sessionId, { wall: stored?.wall ?? wallNow, restarts: stored ? restarts : 0 });
    this.clock = createClock({ origin });

    const storage: PendingStorage = idbAvailable() ? new IdbPendingStorage() : new MemoryPendingStorage();
    // 再開時はサーバ側の最大 seq が分からないので、壁時計ベースの大きな初期値で衝突を避ける
    const startSeq = stored ? Math.floor((wallNow - stored.wall) * 10) + 1_000_000 * restarts : 1;
    this.logger = new EventLogger({ sessionId: this.sessionId, clock: this.clock, sink: fetchSink(), storage, startSeq });
    this.unhookPage = this.logger.installPageHooks();

    if (!stored) this.logger.log({ type: "session_start", t: 0 });
    else this.warn("session_resumed", `リロード後に再開（${restarts} 回目）`);

    // getDisplayMedia はユーザ操作の直後でないと拒否されるので、録画を他の通信より先に始める
    const recorders = this.opts.record.enabled ? await this.startRecorders(restarts) : [];
    if (stored) await this.logger.replayPending();
    // started_at_wall を t=0 の壁時計に合わせる（初回のみ）。recorders もここで一緒に送る
    await this.postStart(stored ? undefined : new Date(wallNow).toISOString(), recorders);
  }

  private async startRecorders(restarts: number): Promise<Recorder[]> {
    const rec = new CaptureRecorder({
      sessionId: this.sessionId,
      clock: this.clock,
      logger: this.logger,
      onStatus: this.opts.onRecorderStatus,
      // リロード後は同じ .part に継ぎ足すと WebM が壊れるので別ファイルにする（01 §6.2）
      mediaSuffix: restarts > 0 ? `-r${restarts}` : "",
    });
    this.recorder = rec;
    rec.startHousekeeping();
    const started: Recorder[] = [];
    // 画面共有ダイアログを先に出す（ユーザ操作の有効期限内に呼ぶため）。カメラは許可済みなので待たずに取れる
    const screenP = this.opts.record.screen
      ? rec.startScreen().catch((e) => {
          this.warn("screen_unavailable", e instanceof Error ? e.message : String(e));
          return null;
        })
      : Promise.resolve(null);
    try {
      const cam = await rec.startCamera(this.opts.record.camera, this.opts.deviceIds);
      if (cam) started.push(cam);
    } catch (e) {
      this.warn("cam_unavailable", e instanceof Error ? e.message : String(e));
    }
    const scr = await screenP;
    if (scr) started.push(scr);
    if (restarts > 0) {
      // Recorder.id は cam|screen のみなので session.json の recorders には載せない（finalize の対象外。既知の制約）
      for (const r of started) this.warn("recorder_restarted", `${r.id} → ${r.file}`);
      return [];
    }
    this.recorders = started;
    return started;
  }

  private async postStart(startedAtWall?: string, recorders: Recorder[] = []) {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(this.sessionId)}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recorders, ...(startedAtWall ? { started_at_wall: startedAtWall } : {}) }),
      });
    } catch (e) {
      this.warn("start_failed", e instanceof Error ? e.message : String(e));
    }
  }

  warn(code: string, detail?: string) {
    const t = this.clock?.now() ?? 0;
    this.warnings.push({ t, code, detail });
    this.logger?.log({ type: "warning", code, detail });
    this.opts.onWarning?.(code, detail);
  }

  async saveSnapshot(args: { fileId: string; t: number; version: number; text: string; seq: number }) {
    const res = await fetch(`/api/sessions/${encodeURIComponent(this.sessionId)}/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: args.fileId, t: args.t, version: args.version, text: args.text, seq: args.seq }),
    });
    if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
    return res.json();
  }

  /** RunResult を保存し run イベントをサーバ側で追記してもらう */
  async saveRun(run: RunResult, file?: string) {
    const seq = this.logger.nextSeq();
    const q = new URLSearchParams({ seq: String(seq), ...(file ? { file } : {}) });
    const res = await fetch(`/api/sessions/${encodeURIComponent(this.sessionId)}/runs?${q}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(run),
    });
    if (!res.ok) this.warn("run_save_failed", `HTTP ${res.status}`);
  }

  /** 終了。録画を止めて送り切り、session_end を送ってから /end */
  async end(reason: "user" | "timeout"): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    let recUpdates: Partial<Recorder>[] = [];
    try {
      recUpdates = (await this.recorder?.stopAll()) ?? [];
    } catch (e) {
      this.warn("recorder_stop_failed", e instanceof Error ? e.message : String(e));
    }
    const ended_t = this.clock.now();
    this.logger.log({ type: "session_end", reason, t: ended_t });
    const drained = await this.logger.drain(5);
    if (!drained) this.warn("events_pending", "一部のイベントが未送信です（IndexedDB に保持）");
    this.logger.stop();
    this.unhookPage?.();
    const recorders = recUpdates.filter((r) => r.id === "cam" || r.id === "screen");
    const res = await fetch(`/api/sessions/${encodeURIComponent(this.sessionId)}/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ended_t, reason, recorders: this.resumed ? [] : recorders, warnings: this.warnings }),
    });
    if (!res.ok) throw new Error(`終了処理に失敗しました (HTTP ${res.status})`);
    clearStoredOrigin(this.sessionId);
  }
}
