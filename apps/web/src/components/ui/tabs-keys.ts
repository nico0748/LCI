/**
 * WAI-ARIA Tabs の矢印キー操作（DADS `useTabAria` と同じ: 端で止まる、Home/End で端へ）。
 * 対象外のキーは null。純関数なので ui.test.ts で検査する。
 */
export function nextTabIndex(key: string, current: number, count: number, orientation: "horizontal" | "vertical" = "horizontal"): number | null {
  if (count <= 0) return null;
  const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  switch (key) {
    case prev:
      return Math.max(0, current - 1);
    case next:
      return Math.min(count - 1, current + 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
