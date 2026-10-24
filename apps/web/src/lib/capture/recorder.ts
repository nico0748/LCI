import type { Recorder } from "@lci/core";
import type { SessionClock } from "./clock.ts";
import type { EventLogger } from "./event-logger.ts";

/**
 * 録画（要件書 01 §2.1, §2.4）。
 * - カメラ＋マイクを 1 本の MediaStream にまとめ 1 つの MediaRecorder で録る（A/V 同期をブラウザに任せる）
 * - timeslice 2000ms。チャンクは受け取った瞬間に PUT /media/<recorder>（直列キュー・バックオフ再送）
 * - t_rec_start は start() 呼出時ではなく onstart の timeStamp（FR-C-41）
 * - 画面は getDisplayMedia({preferCurrentTab}) の別 Recorder "screen"（FR-C-04/05/45）
 * - トラック ended は warning イベントを残してその Recorder だけ止める（FR-C-07）
 * - 60 秒ごとに heartbeat（受領チャンク数・バイト数・visibility）（FR-C-43）
 */

export type RecorderId = "cam" | "screen";

export interface RecorderStatus {
  id: RecorderId;
  state: "idle" | "starting" | "recording" | "stopped" | "error";
  chunks: number;
  /** サーバが受領したバイト数（最後の応答） */
  bytes: number;
  pendingUploads: number;
  uploadFailures: number;
  t_rec_start?: number;
  t_rec_stop?: number;
  error?: string;
}

export interface CaptureRecorderOptions {
  sessionId: string;
  clock: SessionClock;
  logger: EventLogger;
  baseUrl?: string;
  timesliceMs?: number;
  onStatus?: (status: RecorderStatus[]) => void;
  /** 音量メータ用: マイクの RMS（0〜1）を定期的に受け取る */
  onLevel?: (rms: number) => void;
  /** リロード後の再開時に別ファイルへ書くための接尾辞（例 "-r1" → media/cam-r1.webm.part） */
  mediaSuffix?: string;
}

export function pickMimeType(kind: "video" | "video-only"): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates =
    kind === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** 直列アップロードキュー。順序を保ち、失敗したら指数バックオフで同じチャンクを再送する */
class ChunkUploader {
  private queue: Blob[] = [];
  private running = false;
  chunks = 0;
  bytes = 0;
  failures = 0;
  constructor(
    private readonly url: string,
    private readonly onProgress: () => void,
    private readonly onGiveUp: (err: string) => void,
  ) {}
  get pending() {
    return this.queue.length + (this.running ? 1 : 0);
  }
  push(blob: Blob) {
    this.queue.push(blob);
    void this.pump();
  }
  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const blob = this.queue[0]!;
        let attempt = 0;
        for (;;) {
          try {
            const res = await fetch(this.url, { method: "PUT", headers: { "content-type": "video/webm" }, body: blob });
            if (res.ok) {
              const j = (await res.json().catch(() => ({}))) as { bytes?: number };
              this.chunks++;
              this.bytes = typeof j.bytes === "number" ? j.bytes : this.bytes + blob.size;
              break;
            }
            if (res.status >= 400 && res.status < 500) {
              // 409 など: セッションが終わっている。捨てる
              this.onGiveUp(`HTTP ${res.status}`);
              break;
            }
            throw new Error(`HTTP ${res.status}`);
          } catch (e) {
            attempt++;
            this.failures++;
            if (attempt >= 8) {
              this.onGiveUp(e instanceof Error ? e.message : String(e));
              break;
            }
            await new Promise((r) => setTimeout(r, Math.min(10_000, 500 * 2 ** attempt)));
          }
        }
        this.queue.shift();
        this.onProgress();
      }
    } finally {
      this.running = false;
    }
  }
  /** 全部送り切るまで待つ（終了時）。上限時間を超えたら諦める */
  async drain(maxMs = 15_000) {
    const t0 = Date.now();
    while (this.pending > 0 && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 100));
    return this.pending === 0;
  }
}

interface Track {
  id: RecorderId;
  kind: Recorder["kind"];
  stream: MediaStream;
  recorder: MediaRecorder;
  uploader: ChunkUploader;
  status: RecorderStatus;
  mime: string;
  surface?: string;
}

export class CaptureRecorder {
  private tracks = new Map<RecorderId, Track>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private visibilityHandler: (() => void) | null = null;
  readonly timesliceMs: number;

  constructor(private readonly opts: CaptureRecorderOptions) {
    this.timesliceMs = opts.timesliceMs ?? 2000;
  }

  statuses(): RecorderStatus[] {
    return [...this.tracks.values()].map((t) => ({ ...t.status, pendingUploads: t.uploader.pending, uploadFailures: t.uploader.failures, chunks: t.uploader.chunks, bytes: t.uploader.bytes }));
  }

  private emitStatus() {
    this.opts.onStatus?.(this.statuses());
  }

  private warn(code: string, detail?: string) {
    this.opts.logger.log({ type: "warning", code, detail });
  }

  /** カメラ＋マイク（camera=false ならマイクのみ）。戻り値は /start に送る Recorder */
  async startCamera(camera: boolean, deviceIds?: { audio?: string; video?: string }): Promise<Recorder | null> {
    const constraints: MediaStreamConstraints = {
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, ...(deviceIds?.audio ? { deviceId: { exact: deviceIds.audio } } : {}) },
      video: camera ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 24 }, ...(deviceIds?.video ? { deviceId: { exact: deviceIds.video } } : {}) } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.startLevelMeter(stream);
    const mime = camera ? pickMimeType("video") : (["audio/webm;codecs=opus", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "");
    return this.startTrack("cam", camera ? "camera+mic" : "mic", stream, mime, { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 48_000 });
  }

  /** 自タブの画面（FR-C-04）。ユーザがキャンセルしたら null */
  async startScreen(): Promise<Recorder | null> {
    let stream: MediaStream;
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia(c?: unknown): Promise<MediaStream> };
      stream = await md.getDisplayMedia({
        video: { frameRate: { ideal: 10, max: 10 } },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude",
      });
    } catch (e) {
      this.warn("screen_denied", e instanceof Error ? e.message : String(e));
      return null;
    }
    const settings = stream.getVideoTracks()[0]?.getSettings() as { displaySurface?: string } | undefined;
    const surface = settings?.displaySurface ?? "unknown";
    return this.startTrack("screen", "display", stream, pickMimeType("video-only"), { videoBitsPerSecond: 1_000_000 }, surface);
  }

  private startTrack(id: RecorderId, kind: Recorder["kind"], stream: MediaStream, mime: string, bits: MediaRecorderOptions, surface?: string): Promise<Recorder> {
    return new Promise<Recorder>((resolve, reject) => {
      const base = this.opts.baseUrl ?? "";
      const status: RecorderStatus = { id, state: "starting", chunks: 0, bytes: 0, pendingUploads: 0, uploadFailures: 0 };
      const uploader = new ChunkUploader(
        `${base}/api/sessions/${encodeURIComponent(this.opts.sessionId)}/media/${id}${this.opts.mediaSuffix ?? ""}`,
        () => this.emitStatus(),
        (err) => this.warn("upload_failed", `${id}: ${err}`),
      );
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), ...bits });
      } catch (e) {
        reject(e);
        return;
      }
      const track: Track = { id, kind, stream, recorder: rec, uploader, status, mime: rec.mimeType || mime, surface };
      this.tracks.set(id, track);

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) uploader.push(e.data);
      };
      rec.onstart = (e) => {
        // start() 呼出時ではなく実際に録画が始まった時刻（FR-C-41）
        const t = this.opts.clock.fromTimeStamp(e.timeStamp);
        status.t_rec_start = t;
        status.state = "recording";
        this.opts.logger.log({ type: "recorder_start", recorder: id, t });
        this.emitStatus();
        resolve({
          id,
          kind,
          surface,
          file: `media/${id}${this.opts.mediaSuffix ?? ""}.webm`,
          mime: track.mime,
          t_rec_start: t,
          scale: 1,
          chunk_ms: this.timesliceMs,
          chunks_received: 0,
          bytes: 0,
          gaps: [],
        });
      };
      rec.onerror = (e) => {
        const msg = (e as { error?: { message?: string } }).error?.message ?? "MediaRecorder error";
        status.state = "error";
        status.error = msg;
        this.warn("recorder_error", `${id}: ${msg}`);
        this.emitStatus();
        reject(new Error(msg));
      };
      rec.onstop = () => {
        status.state = "stopped";
        status.t_rec_stop = this.opts.clock.now();
        this.opts.logger.log({ type: "recorder_stop", recorder: id });
        this.emitStatus();
      };
      for (const tr of stream.getTracks()) {
        tr.addEventListener("ended", () => {
          if (status.state !== "recording") return;
          // 共有停止ボタン・デバイス消失。セッションは止めず、この Recorder だけ止める（FR-C-07）
          this.warn("track_ended", `${id}/${tr.kind}: ${tr.label}`);
          this.stopTrack(id);
        });
      }
      rec.start(this.timesliceMs);
    });
  }

  private stopTrack(id: RecorderId) {
    const t = this.tracks.get(id);
    if (!t) return;
    if (t.recorder.state !== "inactive") {
      try {
        t.recorder.requestData();
      } catch {
        /* ignore */
      }
      t.recorder.stop();
    }
    for (const tr of t.stream.getTracks()) tr.stop();
  }

  /** heartbeat と visibility の記録を開始 */
  startHousekeeping() {
    this.heartbeat = setInterval(() => {
      const cam = this.tracks.get("cam");
      const screen = this.tracks.get("screen");
      this.opts.logger.log({
        type: "heartbeat",
        visibility: document.visibilityState === "hidden" ? "hidden" : "visible",
        cam_chunks: cam?.uploader.chunks,
        cam_bytes: cam?.uploader.bytes,
        screen_chunks: screen?.uploader.chunks,
      });
    }, 60_000);
    this.visibilityHandler = () => {
      this.opts.logger.log({ type: "visibility", state: document.visibilityState === "hidden" ? "hidden" : "visible" });
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private startLevelMeter(stream: MediaStream) {
    if (!this.opts.onLevel || stream.getAudioTracks().length === 0) return;
    try {
      const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return;
      this.audioCtx = new Ctor();
      const src = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      this.levelTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        this.opts.onLevel?.(Math.sqrt(sum / buf.length));
      }, 250);
    } catch {
      /* 音量メータは補助機能。失敗しても録画は続ける */
    }
  }

  /** 終了。recorder を止め、残りのチャンクを送り切る（上限 15 秒）。戻り値は /end に渡す Recorder 差分 */
  async stopAll(): Promise<Partial<Recorder>[]> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.levelTimer) clearInterval(this.levelTimer);
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
    void this.audioCtx?.close().catch(() => {});
    const stops: Promise<void>[] = [];
    for (const [id, t] of this.tracks) {
      if (t.recorder.state !== "inactive") {
        stops.push(new Promise<void>((res) => {
          const prev = t.recorder.onstop;
          t.recorder.onstop = (e) => {
            prev?.call(t.recorder, e);
            res();
          };
          setTimeout(res, 3000);
        }));
      }
      this.stopTrack(id);
    }
    await Promise.all(stops);
    await Promise.all([...this.tracks.values()].map((t) => t.uploader.drain()));
    return [...this.tracks.values()].map((t) => ({
      id: t.id,
      t_rec_start: t.status.t_rec_start,
      t_rec_stop: t.status.t_rec_stop ?? this.opts.clock.now(),
      chunks_received: t.uploader.chunks,
      bytes: t.uploader.bytes,
    }));
  }

  /** プレビュー用: カメラのストリーム */
  cameraStream(): MediaStream | null {
    return this.tracks.get("cam")?.stream ?? null;
  }
}

/** ブリーフィング画面用の権限チェック＋プレビュー */
export async function probeDevices(camera: boolean): Promise<{ stream: MediaStream | null; error: string | null; devices: MediaDeviceInfo[] }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: camera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return { stream, error: null, devices };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    const msg =
      name === "NotAllowedError"
        ? "カメラ／マイクの使用が許可されていません。ブラウザのサイト設定（アドレスバー左のアイコン）から許可してください。"
        : name === "NotFoundError"
          ? "カメラまたはマイクが見つかりません。"
          : `デバイスを取得できません: ${e instanceof Error ? e.message : String(e)}`;
    return { stream: null, error: msg, devices: [] };
  }
}
