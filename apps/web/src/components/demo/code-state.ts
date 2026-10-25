/**
 * デモのコードの状態 code(t)（01 §3「コードの状態」、02 §8.1 シーク）。純関数なので node --test で試験する。
 *
 * - code(t) = 直前の keyframe（snapshot イベント ref="kf:<step_id>"）＋その後の edit を t まで当てた全文
 * - 再生中は前回からの差分だけを Monaco の model.applyEdits で当てる（value の差し替えはしない。02 F3）
 * - 時刻が戻ったとき・遠くへ飛んだときは code(t) を作り直し、変わった部分だけを 1 回で置き換える
 * - 「まとめて」表示ではグループ（step の打鍵）の開始時刻にグループ全体を一度に出す（01 §3「表示の切り替え」）
 */
import { applyEdit, type Event, type EventOf, type Range } from "@lci/core/browser";
import type { CompiledDemo, CompiledStep } from "@lci/demo/browser";

export type TypingMode = "char" | "group";

export interface CodeSource {
  fileId: string;
  initial: string;
  events: Event[];
  keyframes: Record<string, string>;
}

export function codeSource(demo: Pick<CompiledDemo, "file" | "initial" | "events" | "keyframes">): CodeSource {
  // 二分探索するので時刻順を保証する（同時刻は元の並び＝seq の順を保つ安定ソート）
  const sorted = demo.events.every((e, i, a) => i === 0 || a[i - 1]!.t <= e.t) ? demo.events : [...demo.events].sort((a, b) => a.t - b.t);
  return { fileId: demo.file.file_id, initial: demo.initial, events: sorted, keyframes: demo.keyframes };
}

/** t より後の最初のイベントの添字（= t まで当てたときの「次に当てる位置」） */
export function nextIndexAfter(events: Event[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 時刻 t（含む）の全文。next は次に当てるイベントの添字 */
export function textAt(src: CodeSource, t: number): { text: string; next: number } {
  const end = nextIndexAfter(src.events, t);
  let base = src.initial;
  let from = 0;
  for (let i = end - 1; i >= 0; i--) {
    const e = src.events[i]!;
    if (e.type === "snapshot" && e.file === src.fileId && e.ref in src.keyframes) {
      base = src.keyframes[e.ref]!;
      from = i + 1;
      break;
    }
  }
  let text = base;
  for (let i = from; i < end; i++) {
    const e = src.events[i]!;
    if (e.type === "edit" && e.file === src.fileId) text = applyEdit(text, e.changes);
  }
  return { text, next: end };
}

/**
 * 表示モードを考えた実効時刻。「まとめて」では、打鍵中の step はその打鍵の終わりまで当てる。
 * 字幕・音声・実行の時刻は変えない（タイムラインは同じ）。
 */
export function effectiveCodeTime(steps: CompiledStep[], t: number, mode: TypingMode): number {
  if (mode === "char") return t;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.t0 > t) continue;
    if (s.typing && t >= s.typing.t0 && t < s.typing.t1) return s.typing.t1;
    return t;
  }
  return t;
}

export type CodeUpdate =
  | { kind: "none"; next: number }
  /** events[from, to) の edit を順に当てる */
  | { kind: "incremental"; from: number; to: number; edits: EventOf<"edit">["changes"][] }
  /** 全文を作り直す（実際の置き換えは minimalReplace で差分だけにする） */
  | { kind: "reset"; text: string; next: number };

/**
 * 前回の状態（next, t）から新しい時刻への更新を決める。
 * 進むときは差分適用、戻るとき・maxIncremental を超えて飛ぶときは作り直す。
 */
export function planUpdate(src: CodeSource, prev: { next: number; t: number } | null, t: number, maxIncremental = 600): CodeUpdate {
  const next = nextIndexAfter(src.events, t);
  if (prev && t >= prev.t && next - prev.next <= maxIncremental) {
    if (next === prev.next) return { kind: "none", next };
    const edits: EventOf<"edit">["changes"][] = [];
    for (let i = prev.next; i < next; i++) {
      const e = src.events[i]!;
      if (e.type === "edit" && e.file === src.fileId) edits.push(e.changes);
    }
    return { kind: "incremental", from: prev.next, to: next, edits };
  }
  return { kind: "reset", text: textAt(src, t).text, next };
}

/** 変わった部分だけを置き換える 1 回の編集（スクロール位置と装飾をできるだけ保つ） */
export function minimalReplace(before: string, after: string): { start: number; end: number; text: string } | null {
  if (before === after) return null;
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before.charCodeAt(p) === after.charCodeAt(p)) p++;
  // サロゲートペアを割らない
  if (p > 0 && isHighSurrogate(before.charCodeAt(p - 1))) p--;
  let q = 0;
  while (q < max - p && before.charCodeAt(before.length - 1 - q) === after.charCodeAt(after.length - 1 - q)) q++;
  if (q > 0 && isLowSurrogate(before.charCodeAt(before.length - q))) q--;
  return { start: p, end: before.length - q, text: after.slice(p, after.length - q) };
}

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

/** 文字オフセット → Monaco の 1 始まり [行, 列]（列は UTF-16 単位） */
export function positionOf(text: string, offset: number): [number, number] {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return [line, Math.min(offset, text.length) - lineStart + 1];
}

/**
 * before → after で変わった行の範囲（after の 1 始まりの行番号）。同じなら null。
 * 前後の共通行を落とすだけの簡易版（step 内の編集はほぼ 1 か所にまとまるので十分）。
 * 削除だけのときは、消えた位置の行を 1 行返す。
 */
export function changedLines(before: string, after: string): [number, number] | null {
  if (before === after) return null;
  const a = before.split("\n");
  const b = after.split("\n");
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const start = p + 1;
  const end = b.length - q;
  if (end < start) return [Math.min(start, b.length), Math.min(start, b.length)];
  return [start, end];
}

export interface CaretView {
  /** 1 始まりの [行, 列] */
  pos: [number, number];
  /** 削除・置換の前に見せる選択範囲 */
  sel: Range | null;
}

/** 1 つの変更を当てた後のカーソル位置（挿入した文字列の終わり） */
function endOfChange(c: EventOf<"edit">["changes"][number]): [number, number] {
  const lines = c.text.split("\n");
  if (lines.length === 1) return [c.range[0], c.range[1] + c.text.length];
  return [c.range[0] + lines.length - 1, lines[lines.length - 1]!.length + 1];
}

/**
 * 時刻 t の疑似カーソル（直近の cursor か edit）。from より前のイベントは見ない（step の頭から探す）。
 * 選択は cursor イベントが最後のときだけ（その直後の edit で消える）。
 */
export function caretAt(src: CodeSource, t: number, fromT = 0): CaretView | null {
  const end = nextIndexAfter(src.events, t);
  for (let i = end - 1; i >= 0; i--) {
    const e = src.events[i]!;
    if (e.t < fromT) break;
    if (e.type === "cursor" && e.file === src.fileId) return { pos: e.pos, sel: e.sel && !isEmptyRange(e.sel) ? e.sel : null };
    if (e.type === "edit" && e.file === src.fileId && e.changes.length) {
      // changes は後ろから当てても衝突しない並び。最初（文書の後方）の変更の終わりにカーソルを置く
      const c = [...e.changes].sort((x, y) => y.range[0] - x.range[0] || y.range[1] - x.range[1])[0]!;
      return { pos: endOfChange(c), sel: null };
    }
  }
  return null;
}

const isEmptyRange = (r: Range) => r[0] === r[2] && r[1] === r[3];

/** 行数（末尾の改行の後ろも 1 行と数える Monaco と同じ数え方） */
export function lineCount(text: string): number {
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}
