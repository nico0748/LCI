import type { Event, Language, Transcript } from "@lci/core/browser";
import type { AudioManifest, ChapterPhase, DemoScript, RunSnapshot } from "./schema.ts";

/**
 * 再生側との契約（docs/requirements/demo/00_decisions.md §API）。
 * CompiledDemo は台本＋音声マニフェストからの純関数の結果で、保存しない。
 * 時刻はすべて ms、デモ開始 = 0。
 */
export interface CompiledStep {
  id: string;
  chapter: string;
  t0: number;
  t1: number;
  say?: { t0: number; t1: number; text: string; audio_key?: string };
  typing?: { t0: number; t1: number };
  run?: { t: number; shown_until: number; mode: "sample" | "stdin" | "judge"; result: RunSnapshot };
  highlight?: { range: [number, number, number, number] };
  covers: string[];
}

export interface CompiledDemo {
  duration: number;
  file: { file_id: "f1"; path: string; language: Language };
  /** t=0 の全文（starter または空） */
  initial: string;
  /** 既存のイベント型: snapshot（ref="kf:<step_id>"）/ cursor / edit / run / marker */
  events: Event[];
  /** 字幕。segments[].t_start / t_end / text なので TranscriptPane を流用できる */
  narration: Transcript;
  steps: CompiledStep[];
  chapters: { id: string; title: string; phase: ChapterPhase; axes: string[]; t0: number; t1: number }[];
  /** "kf:<step_id>" → ステップ開始時点の全文（reconstructFileAt の resolver に渡す） */
  keyframes: Record<string, string>;
  timing_source: "measured" | "estimated";
}

export type AudioStatus = "none" | "generating" | "ready" | "failed" | "unavailable";

/** GET /api/demos?problem=<id> の 1 行（ネタバレを含まない） */
export interface DemoSummary {
  demo_id: string;
  revision: number;
  problem_id: string;
  language: Language;
  title: string;
  created_at: string;
  author_model: string;
  final_verdict: RunSnapshot["verdict"];
  passed: number;
  total: number;
  estimate_ms: number;
  audio_status: AudioStatus;
  audio_bytes: number | null;
}

/** GET /api/demos/<demo_id>?reveal=1 */
export interface DemoDetail {
  summary: DemoSummary;
  script: DemoScript;
  compiled: CompiledDemo;
  audio: AudioManifest | null;
  /** generating のときの進捗（区間数） */
  audio_progress?: { done: number; total: number };
  /** 音声区間の URL の雛形。{key} を AudioManifest.segments[].key で置き換える */
  audio_url_template: string;
}
