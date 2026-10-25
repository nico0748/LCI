/**
 * 実行・判定結果の見せ方（03 §3.6 / §3.7）。純関数（session-helpers.test.ts）。
 * - 自分で押した「実行」の結果（stdout の上の 1 行）は StatusBadge で状態色を付ける（X2）
 * - 「判定」の結果は採点しない: 色・アイコンを付けず、件数だけの静止テキスト（04 §7 原則 2）
 */
import type { RunResult } from "@lci/core/browser";
import type { ChipTone } from "../ui/StatusBadge.tsx";

const VERDICT: Record<RunResult["verdict"], { tone: ChipTone; label: string }> = {
  AC: { tone: "success", label: "正常終了" },
  PASS: { tone: "success", label: "正常終了" },
  RE: { tone: "danger", label: "実行時エラー" },
  CE: { tone: "danger", label: "コンパイルエラー" },
  IE: { tone: "danger", label: "実行環境のエラー" },
  WA: { tone: "danger", label: "出力が不一致" },
  FAIL: { tone: "danger", label: "失敗" },
  TLE: { tone: "warning", label: "時間超過" },
  MLE: { tone: "warning", label: "メモリ超過" },
  OLE: { tone: "warning", label: "出力が多すぎます" },
};

/** 実行結果の 1 行: 「正常終了 · 120ms」。終了コードは 0 以外のときだけ出す */
export function runHeadline(run: Pick<RunResult, "verdict" | "exit_code" | "duration_ms">): { tone: ChipTone; label: string; meta: string } {
  const v = VERDICT[run.verdict];
  const exit = run.exit_code !== undefined && run.exit_code !== 0 ? `終了コード ${run.exit_code} · ` : "";
  return { tone: v.tone, label: v.label, meta: `${exit}${Math.round(run.duration_ms)}ms` };
}

/** mm:ss（セッション時刻） */
export function sessionClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 判定の状態行: 「判定 12:34　サンプル 3 / 5 通過」＋（幅があれば）「詳細は振り返りで」 */
export function judgeLine(tMs: number, passed: number, total: number): { main: string; note: string } {
  return { main: `判定 ${sessionClock(tMs)}　サンプル ${passed} / ${total} 通過`, note: "詳細は振り返りで" };
}

/** 通信タブの状態 */
export const REQUEST_STATUS_LABEL = { completed: "完了", aborted: "中断", failed: "失敗", blocked: "ブロック" } as const;
