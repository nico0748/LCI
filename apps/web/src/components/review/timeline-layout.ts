/**
 * タイムラインの描画とキー操作のための純粋な計算（04 §3）。DOM に触れないのでテストできる。
 */

/** 編集量の段数（viz-seq-1..4） */
export const EDIT_LEVELS = 4;

export type EditLevel = 0 | 1 | 2 | 3 | 4;

/**
 * 編集量（変更文字数）を 4 段の順序尺度に量子化する。0 は「編集なし」。
 * 文字数は裾が長いので log で潰してから等分する（04 §3.3。不透明度による濃淡はやめた）。
 */
export function editLevel(chars: number, maxChars: number): EditLevel {
  if (chars <= 0 || maxChars <= 0) return 0;
  const v = Math.log1p(chars) / Math.log1p(maxChars);
  return Math.min(EDIT_LEVELS, Math.max(1, Math.ceil(v * EDIT_LEVELS - 1e-9))) as EditLevel;
}

/** 各段の上限（文字数）。凡例とツールチップに「〜n 文字」と出すため。段 1..4 の順 */
export function editLevelBounds(maxChars: number): number[] {
  if (maxChars <= 0) return [0, 0, 0, 0];
  const L = Math.log1p(maxChars);
  return Array.from({ length: EDIT_LEVELS }, (_, i) => Math.max(1, Math.floor(Math.expm1((L * (i + 1)) / EDIT_LEVELS) + 1e-9)));
}

/** 1 バケットが minPx 以上の幅になる本数（240 固定だと細い縦棒がちらつくだけになる） */
export function bucketCountFor(widthPx: number, minPx = 6, min = 12, max = 240): number {
  return Math.min(max, Math.max(min, Math.floor(widthPx / minPx)));
}

const TICK_STEPS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000];

/** 目盛りの間隔。ラベル同士が minGapPx 以上離れる最小の刻み（モバイルで「01:0002:00…」と重ならないように） */
export function tickStepFor(durationMs: number, widthPx: number, minGapPx = 64): number {
  if (durationMs <= 0 || widthPx <= 0) return TICK_STEPS[TICK_STEPS.length - 1]!;
  for (const s of TICK_STEPS) if ((s / durationMs) * widthPx >= minGapPx) return s;
  return TICK_STEPS[TICK_STEPS.length - 1]!;
}

export function tickTimes(durationMs: number, stepMs: number): number[] {
  const out: number[] = [];
  if (stepMs <= 0) return out;
  for (let t = 0; t <= durationMs + 1e-6; t += stepMs) out.push(t);
  return out;
}

/**
 * ピンの段組み。x の昇順に置き、同じ段の前のピンと minGap 未満なら次の段へ（rows 段を超えたら最も空いた段）。
 * 返り値は入力順の段番号。
 */
export function stackRows(xs: number[], minGap: number, rows = 2): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const lastX = Array.from({ length: rows }, () => -Infinity);
  const out = new Array<number>(xs.length).fill(0);
  for (const { x, i } of order) {
    let row = lastX.findIndex((lx) => x - lx >= minGap);
    if (row < 0) {
      // どの段も詰まっている: 最も古く置いた段（= 最も左に余裕がある段）に重ねる
      row = lastX.indexOf(Math.min(...lastX));
    }
    lastX[row] = x;
    out[i] = row;
  }
  return out;
}

/**
 * 同期先（再生ワークスペース）を画面に入れる必要があるか。
 * 上端が画面の上 1/4 より下にある、または下端が画面の 6 割に届かないなら「見えていない」とみなす。
 */
export function needsReveal(rect: { top: number; bottom: number }, viewportH: number): boolean {
  const visible = rect.top <= viewportH * 0.25 && rect.bottom >= viewportH * 0.6;
  return !visible;
}

/** キーイベントの発生元の要約（DOM から作って渡す） */
export interface KeyTarget {
  tag: string;
  role: string | null;
  editable: boolean;
  /** Monaco などの内部 */
  inEditor: boolean;
  /** 矢印キーを自前で扱う要素の中（toolbar / tablist / slider） */
  inArrowWidget: boolean;
}

const ACTIVATABLE_TAGS = new Set(["BUTTON", "A", "SUMMARY", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);
const ACTIVATABLE_ROLES = new Set(["button", "link", "tab", "slider", "switch", "checkbox", "radio", "menuitem", "option"]);

/**
 * グローバルのショートカット（Space / ←→ / j k）を発火させてよいか（04 §3.5、S2-5）。
 * - 入力欄・エディタ内では全部止める
 * - Space はボタン・リンク・summary・タブ等にフォーカスがあるときは止める（押下を奪わない）
 * - ←→ は toolbar・tablist・slider の中では止める（各部品が自分で扱う）
 * - 修飾キー付きは止める（ブラウザの操作を奪わない）
 */
export function shortcutAllowed(key: string, target: KeyTarget, modified: boolean): boolean {
  if (modified) return false;
  if (target.editable || target.inEditor) return false;
  const tag = target.tag.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (key === " ") return !ACTIVATABLE_TAGS.has(tag) && !(target.role && ACTIVATABLE_ROLES.has(target.role));
  if (key === "ArrowLeft" || key === "ArrowRight") return !target.inArrowWidget;
  return key === "j" || key === "k";
}
