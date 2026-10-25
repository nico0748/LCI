/** 評価の 3 値（X1）。指摘の重大/改善/良い と、要件の 未実装/言及のみ/実装あり を同じ色と形で表す */
export type EvalLevel = "major" | "minor" | "good";

/** 指摘（feedback）と要件（requirement）で読み上げる語だけが違う */
export const EVAL_LABEL: Record<"feedback" | "requirement", Record<EvalLevel, string>> = {
  feedback: { major: "重大", minor: "改善", good: "良い" },
  requirement: { major: "未実装", minor: "言及のみ", good: "実装あり" },
};

/** core の値から EvalLevel へ。未知の値は null（呼び出し側で無彩色の表示にする） */
export function evalLevelOf(value: string): EvalLevel | null {
  switch (value) {
    case "major":
    case "missing":
      return "major";
    case "minor":
    case "mentioned_only":
      return "minor";
    case "positive":
    case "good":
    case "implemented":
      return "good";
    default:
      return null;
  }
}
