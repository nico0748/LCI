import type { Event, Evaluation, Metrics, ProblemMeta, Session, TimelineRow, Transcript } from "@lci/core/browser";

/** GET /api/sessions/[id]/timeline のレスポンス（lib/review/sessions-api.ts の loadTimeline と同形） */
export interface TimelineData {
  session: Session;
  events: Event[];
  transcript: Transcript | null;
  metrics: Metrics | null;
  rows: TimelineRow[];
}

/** レビュー画面がサーバから受け取る問題側の情報（非公開部分は含めない。解説は別途 reveal で取る） */
export interface ReviewProblemInfo {
  id: string;
  title: string;
  category: ProblemMeta["category"];
  talking_points: ProblemMeta["talking_points"];
  requirements: ProblemMeta["requirements"];
  languages: ProblemMeta["languages"];
}

export type EvaluationList = Evaluation[];

/** タイムライン上のピン。feedback と followup・run を同じ型で扱う */
export interface Pin {
  id: string;
  t: number;
  kind: "feedback" | "run" | "followup";
  severity?: "major" | "minor" | "positive";
  label: string;
  verdict?: string;
}
