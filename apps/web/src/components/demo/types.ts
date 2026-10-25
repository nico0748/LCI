import type { Language, Metrics, ProblemMeta } from "@lci/core/browser";

/** デモ画面がサーバから受け取る問題の情報（解説・参照解・隠しテストは含めない） */
export interface DemoProblemInfo {
  id: string;
  title: string;
  time_limit: number;
  languages: Language[];
  judge_kind: "stdio" | "unit" | "web" | "none";
  statement: string;
  constraints: string;
  talking_points: ProblemMeta["talking_points"];
  requirements: ProblemMeta["requirements"];
  /** 公開のサンプル（実行結果の「入力」欄に使う） */
  samples: { name: string; stdin: string; expected: string }[];
}

/** ゲートと「自分のセッションと比べる」のための、この問題での自分の記録 */
export interface DemoUserRecord {
  /** 終了済みのセッション数（0 ならゲートを出す。FR-D-04） */
  finished: number;
  latestSessionId: string | null;
  latestLanguage: Language | null;
  /** 最新の終了済みセッションの指標（比較表 FR-D-60。無ければ null） */
  latestMetrics: Metrics | null;
  latestDurationMs: number | null;
}
