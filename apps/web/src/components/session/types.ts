import type { Language } from "@lci/core/browser";
import type { WebTestsLike } from "@/lib/capture/sandbox/judge";

/**
 * S3 画面へサーバから渡すデータ。面接官メモ・振り返り解説・参照解は含めない。
 * web 判定はブラウザ内で行うため、シナリオ定義（tests）だけは渡す（画面には出さない）。
 */
export interface InterviewFile {
  fileId: string;
  path: string;
  language: Language;
  initial: string;
}

export interface InterviewData {
  sessionId: string;
  status: string;
  problemId: string;
  title: string;
  statement: string;
  constraints: string;
  timeLimitSec: number;
  language: Language;
  files: InterviewFile[];
  capture: { camera: boolean; screen: boolean; live_stt: boolean };
  interviewerMode: "silent" | "followup";
  followups: { at_sec?: number; silence_sec?: number; text: string }[];
  testsKind: "stdio" | "unit" | "web" | "none";
  webTests: WebTestsLike | null;
  /** stdio の公開サンプル入力（実行パネルの stdin 初期値） */
  sampleStdin: string;
}

export const MONACO_LANGUAGE: Record<Language, string> = {
  c: "c",
  rust: "rust",
  python: "python",
  go: "go",
  typescript: "typescript",
  javascript: "javascript",
  html: "html",
  php: "php",
  sql: "sql",
  markdown: "markdown",
};
