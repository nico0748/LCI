/**
 * 録画インジケータの状態（03 §3.4、FR-U-06 / FR-C-07）。純関数（session-helpers.test.ts）。
 * 正常時は小さく静か（● 録画中）、止まったときだけ大きく赤い帯（compact の danger バナー）にする。
 * 赤は画面上で「録画停止」だけに使う（X4）。
 */
import type { RecorderId, RecorderStatus } from "../../lib/capture/recorder.ts";

export type RecState =
  /** S2 で「録画なし」を選んだ（記録は編集ログと… の範囲。警告しない） */
  | { kind: "off" }
  | { kind: "starting" }
  | { kind: "recording"; silent: boolean }
  | { kind: "stopped"; recorders: RecorderId[]; partial: boolean };

/** セッション中に受け取った警告のうち、録画停止の原因になるもの */
export type StopCause = "track_ended" | "cam_unavailable" | "recorder_error" | "screen_unavailable";

export function recState(args: {
  enabled: boolean;
  statuses: RecorderStatus[];
  /** begin() でカメラ・マイクの取得に失敗した */
  camUnavailable: boolean;
  /** 録音が無音のまま 10 秒以上（FR-C-06） */
  silent: boolean;
}): RecState {
  if (!args.enabled) return { kind: "off" };
  const stopped = args.statuses.filter((s) => s.state === "stopped" || s.state === "error").map((s) => s.id);
  const recording = args.statuses.some((s) => s.state === "recording");
  if (args.camUnavailable && !args.statuses.some((s) => s.id === "cam")) stopped.unshift("cam");
  if (stopped.length > 0) return { kind: "stopped", recorders: stopped, partial: recording };
  if (recording) return { kind: "recording", silent: args.silent };
  return { kind: "starting" };
}

const CAUSE_TEXT: Record<StopCause, string> = {
  track_ended: "デバイスが切断されたか、共有が停止されました",
  cam_unavailable: "カメラ・マイクを取得できませんでした",
  recorder_error: "録画でエラーが発生しました",
  screen_unavailable: "画面共有を開始できませんでした",
};

/** 録画停止バナーの本文（見出し＋原因）。カメラなし（マイクのみ）のときは「録音」と呼ぶ */
export function stoppedMessage(recorders: RecorderId[], camera: boolean, cause: StopCause | null): { title: string; detail: string } {
  const cam = recorders.includes("cam");
  const screen = recorders.includes("screen");
  const title =
    cam && screen ? "録画が止まっています" : screen ? "画面録画が止まっています" : camera ? "カメラとマイクの録画が止まっています" : "マイクの録音が止まっています";
  const why = cause ? `（${CAUSE_TEXT[cause]}）` : "";
  return { title, detail: `${why}編集ログは記録を続けています。` };
}

/** ヘッダの短い表記 */
export function recLabel(state: RecState, camera: boolean): string {
  switch (state.kind) {
    case "off":
      return "録画なし";
    case "starting":
      return "準備中";
    case "recording":
      return camera ? "録画中" : "録音中";
    case "stopped":
      return state.partial ? "一部停止" : "録画停止";
  }
}

/** 詳細ポップオーバーの 1 行（チャンク数・受領 MB・未送信） */
export function recorderDetail(s: RecorderStatus): string {
  const name = s.id === "cam" ? "カメラ・マイク" : "画面";
  const state = { idle: "待機", starting: "開始中", recording: "録画中", stopped: "停止", error: "エラー" }[s.state];
  const pending = s.pendingUploads > 0 ? ` · 未送信 ${s.pendingUploads}` : "";
  return `${name}: ${state} · ${s.chunks} チャンク · ${(s.bytes / 1_000_000).toFixed(1)} MB${pending}`;
}
