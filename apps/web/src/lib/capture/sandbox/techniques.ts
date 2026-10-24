import type { ScenarioResult } from "./protocol.ts";

/**
 * リクエストのパターンから「どの最適化が観測されたか」を推定する（要件書 02 FR-X-03-5）。
 * 採点には使わず、Claude の講評材料（RunResult.behavior.techniques）にするだけ。
 * - empty-skip: 空文字を入力してクリックしたのにリクエストが 0
 * - abort:      aborted なリクエストがある
 * - dedupe:     同じ入力で複数回クリックしたのにリクエストが少なく、最初のリクエストが最初のクリック直後に出ている
 *               （キャッシュ or in-flight 共有）
 * - debounce:   同上だが最初のリクエストが最後のクリックより後に遅れて出ている
 */
export function inferTechniques(results: ScenarioResult[]): string[] {
  const out = new Set<string>();
  for (const r of results) {
    const reqs = r.requests.filter((q) => q.status !== "blocked");
    if (reqs.some((q) => q.status === "aborted")) out.add("abort");

    const lastTyped = r.typed[r.typed.length - 1];
    if (r.clicks.length > 0 && lastTyped === "" && reqs.length === 0) out.add("empty-skip");

    const distinct = new Set(r.typed.filter((v) => v !== ""));
    if (r.clicks.length >= 2 && distinct.size <= 1 && lastTyped !== "" && reqs.length < r.clicks.length) {
      const firstReq = reqs[0];
      const firstClick = r.clicks[0]!;
      const lastClick = r.clicks[r.clicks.length - 1]!;
      if (!firstReq) {
        // 1 回も出ていない: 入力が空でないのに 0 回ならキャッシュ済みとみなす
        out.add("dedupe");
      } else if (firstReq.t <= firstClick + 150) {
        out.add("dedupe");
      } else if (firstReq.t > lastClick) {
        out.add("debounce");
      } else {
        out.add("dedupe");
      }
    }
  }
  return [...out];
}
