/**
 * 面接画面（S3）の 3 ペインの幅（03 §3.2、FR-U-04）。純関数（session-helpers.test.ts）。
 * - 比率は問題の種類（web / それ以外）ごとに保存する。保存値は「全体幅に対する割合」
 * - 最小幅: 問題 240 / エディタ 480 / 右 280。足りないときは右 → 問題の順に削り、エディタを優先する
 * - 問題ペインを畳むと 32px のレールになる（幅 0 で消さない）
 */

export type PaneKind = "web" | "code";
export type PaneRatios = { problem: number; right: number };
export type PaneWidths = { problem: number; editor: number; right: number };

export const PANE_MIN = { problem: 240, editor: 480, right: 280 } as const;
export const RAIL_WIDTH = 32;
/** 区切りを矢印キーで動かす量 */
export const PANE_KEY_STEP = 16;

export const DEFAULT_PANE_RATIOS: Record<PaneKind, PaneRatios> = {
  // web: プレビューに 800px の縮小表示を置くので右を広めに（1440px で 346 / 634 / 460）
  web: { problem: 0.24, right: 0.32 },
  code: { problem: 0.26, right: 0.22 },
};

export const paneStorageKey = (kind: PaneKind) => `lci-pane-ratios:${kind}`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 保存値（JSON 文字列）を読む。壊れていたら既定値 */
export function parsePaneRatios(raw: string | null | undefined, kind: PaneKind): PaneRatios {
  const fallback = DEFAULT_PANE_RATIOS[kind];
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<PaneRatios>;
    const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0.05 && x < 0.7;
    if (!ok(v.problem) || !ok(v.right) || v.problem + v.right > 0.9) return fallback;
    return { problem: v.problem, right: v.right };
  } catch {
    return fallback;
  }
}

/**
 * 全体幅（区切り線を除く）と比率から、各ペインの px 幅を決める。
 * エディタが最小幅を割るときは右、次に問題を最小幅まで削る。それでも足りなければエディタが残りを使う。
 */
export function resolvePaneWidths(total: number, ratios: PaneRatios, problemOpen: boolean): PaneWidths {
  const t = Math.max(0, Math.round(total));
  let problem = problemOpen ? Math.max(PANE_MIN.problem, Math.round(t * ratios.problem)) : RAIL_WIDTH;
  let right = Math.max(PANE_MIN.right, Math.round(t * ratios.right));
  let over = problem + right + PANE_MIN.editor - t;
  if (over > 0) {
    const cut = Math.min(over, right - PANE_MIN.right);
    right -= cut;
    over -= cut;
  }
  if (over > 0 && problemOpen) {
    const cut = Math.min(over, problem - PANE_MIN.problem);
    problem -= cut;
    over -= cut;
  }
  return { problem, right, editor: Math.max(0, t - problem - right) };
}

/**
 * 区切りを動かした結果の比率。`which` のペインを `px` にしたいとき、最小幅とエディタの最小幅を守って丸める。
 */
export function resizePane(total: number, ratios: PaneRatios, problemOpen: boolean, which: "problem" | "right", px: number): PaneRatios {
  if (total <= 0) return ratios;
  const cur = resolvePaneWidths(total, ratios, problemOpen);
  const other = which === "problem" ? cur.right : cur.problem;
  const max = Math.max(PANE_MIN[which], total - other - PANE_MIN.editor);
  const next = clamp(Math.round(px), PANE_MIN[which], max);
  return { ...ratios, [which]: next / total };
}
