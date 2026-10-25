import type { Range } from "@lci/core/browser";
import type { OpRegion } from "./ops.ts";
import { graphemeBoundaries, graphemes, posAt, rangeOf } from "./text.ts";

/**
 * 打鍵化（02 §2 の規則）。1 つのコード操作を「人が打ったような」編集の列に展開する。
 * - old→new は行単位 LCS で塊に分け、各塊で共通の接頭辞・接尾辞を落とす（変わった部分だけを打つ）
 * - 削除は 10 文字以下（改行なし）なら Backspace で 1 書記素ずつ、それより長ければ範囲選択を見せてから 1 回で消す
 * - 挿入は書記素単位。改行の直後の行頭空白は改行と同じ単位で入れる（自動インデント相当）
 * - 書記素の途中（サロゲートペア・結合文字）では切らない
 * 時刻はここでは決めない（compile.ts が説明の長さから割り付ける）。
 */

export interface Change {
  range: Range;
  rangeLength: number;
  text: string;
}

export type Unit =
  /** カーソル移動（cursor イベント） */
  | { kind: "jump"; pos: [number, number] }
  /** 削除前の範囲選択を見せる（cursor イベント、sel 付き） */
  | { kind: "select"; pos: [number, number]; sel: Range }
  /** 選択範囲を 1 回で消す */
  | { kind: "delete"; change: Change }
  /** Backspace 1 回（1 書記素） */
  | { kind: "backspace"; change: Change }
  /** 1 書記素（または改行＋行頭空白）を打つ */
  | { kind: "type"; change: Change; newline: boolean; fast: boolean }
  /** pace=instant: 塊ごと 1 回で置き換える */
  | { kind: "instant"; change: Change };

export interface HumanizeResult {
  text: string;
  units: Unit[];
  /** 操作後のカーソル位置（オフセット） */
  cursor: number;
}

export type Pace = "type" | "fast" | "instant";

interface Hunk {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

/** 行に分ける（改行を各行の末尾に残すので、連結すると元に戻る） */
function splitKeep(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const nl = s.indexOf("\n", i);
    if (nl === -1) {
      out.push(s.slice(i));
      break;
    }
    out.push(s.slice(i, nl + 1));
    i = nl + 1;
  }
  return out;
}

const LCS_CELL_CAP = 4_000_000;

/** 行単位 LCS の差分塊。各塊は書記素境界で共通部分を落としたもの */
export function diffHunks(a: string, b: string): Hunk[] {
  const la = splitKeep(a);
  const lb = splitKeep(b);
  // 先頭・末尾の一致行を先に落とす（DP を小さくする）
  let pre = 0;
  while (pre < la.length && pre < lb.length && la[pre] === lb[pre]) pre++;
  let suf = 0;
  while (suf < la.length - pre && suf < lb.length - pre && la[la.length - 1 - suf] === lb[lb.length - 1 - suf]) suf++;
  const A = la.slice(pre, la.length - suf);
  const B = lb.slice(pre, lb.length - suf);
  const n = A.length;
  const m = B.length;
  const pairs: [number, number][] = [];
  if (n > 0 && m > 0 && n * m <= LCS_CELL_CAP) {
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) {
        pairs.push([i, j]);
        i++;
        j++;
      } else if (dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!) i++;
      else j++;
    }
  }
  // 行インデックス → 文字オフセット
  const offA = [0];
  for (const l of la) offA.push(offA[offA.length - 1]! + l.length);
  const offB = [0];
  for (const l of lb) offB.push(offB[offB.length - 1]! + l.length);
  const hunks: Hunk[] = [];
  let ai = 0;
  let bj = 0;
  const flush = (aEndLine: number, bEndLine: number) => {
    if (ai < aEndLine || bj < bEndLine) {
      const h = trimHunk(a, b, { aStart: offA[pre + ai]!, aEnd: offA[pre + aEndLine]!, bStart: offB[pre + bj]!, bEnd: offB[pre + bEndLine]! });
      if (h) hunks.push(h);
    }
  };
  for (const [pi, pj] of pairs) {
    flush(pi, pj);
    ai = pi + 1;
    bj = pj + 1;
  }
  flush(n, m);
  return hunks;
}

/** 塊の中で共通の接頭辞・接尾辞を落とす。両方の文字列で書記素境界になる位置でだけ切る */
function trimHunk(a: string, b: string, h: Hunk): Hunk | null {
  const sa = a.slice(h.aStart, h.aEnd);
  const sb = b.slice(h.bStart, h.bEnd);
  const ba = graphemeBoundaries(sa);
  const bb = graphemeBoundaries(sb);
  const max = Math.min(sa.length, sb.length);
  let p = 0;
  while (p < max && sa.charCodeAt(p) === sb.charCodeAt(p)) p++;
  while (p > 0 && !(ba.has(p) && bb.has(p))) p--;
  let s = 0;
  while (s < max - p && sa.charCodeAt(sa.length - 1 - s) === sb.charCodeAt(sb.length - 1 - s)) s++;
  while (s > 0 && !(ba.has(sa.length - s) && bb.has(sb.length - s))) s--;
  if (p === sa.length - s && p === sb.length - s) return null;
  return { aStart: h.aStart + p, aEnd: h.aEnd - s, bStart: h.bStart + p, bEnd: h.bEnd - s };
}

/** 挿入テキストを打鍵の単位に分ける（改行＋直後の行頭空白は 1 単位） */
export function typingTokens(ins: string): string[] {
  const gs = graphemes(ins);
  const out: string[] = [];
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]!;
    if (g === "\n") {
      let tok = g;
      while (i + 1 < gs.length && (gs[i + 1] === " " || gs[i + 1] === "\t")) tok += gs[++i];
      out.push(tok);
    } else out.push(g);
  }
  return out;
}

function splice(doc: string, start: number, end: number, ins: string): string {
  return doc.slice(0, start) + ins + doc.slice(end);
}

/**
 * doc（操作前の全文）に region の置き換えを当てる打鍵列を作る。
 * cursor は直前のカーソル位置（null なら必ず移動を入れる）。
 */
export function humanizeEdit(doc: string, region: OpRegion, pace: Pace, cursor: number | null): HumanizeResult {
  const units: Unit[] = [];
  let cur = doc;
  let caret = cursor;
  let delta = 0;
  const jump = (off: number) => {
    if (caret !== off) units.push({ kind: "jump", pos: posAt(cur, off) });
    caret = off;
  };
  for (const h of diffHunks(region.oldText, region.newText)) {
    const s = region.start + h.aStart + delta;
    const e = region.start + h.aEnd + delta;
    const del = cur.slice(s, e);
    const ins = region.newText.slice(h.bStart, h.bEnd);
    delta += ins.length - del.length;
    if (pace === "instant") {
      units.push({ kind: "instant", change: { range: rangeOf(cur, s, e), rangeLength: del.length, text: ins } });
      cur = splice(cur, s, e, ins);
      caret = s + ins.length;
      continue;
    }
    if (del) {
      if (del.length <= 10 && !del.includes("\n")) {
        jump(e);
        let end = e;
        for (const g of graphemes(del).reverse()) {
          const st = end - g.length;
          units.push({ kind: "backspace", change: { range: rangeOf(cur, st, end), rangeLength: g.length, text: "" } });
          cur = splice(cur, st, end, "");
          end = st;
        }
      } else {
        const range = rangeOf(cur, s, e);
        units.push({ kind: "select", pos: posAt(cur, e), sel: range });
        units.push({ kind: "delete", change: { range, rangeLength: del.length, text: "" } });
        cur = splice(cur, s, e, "");
      }
      caret = s;
    }
    if (ins) {
      jump(s);
      // 挿入は連続しているので、位置は文字列を作り直さずに数えて進める（大きな write で O(n^2) にしない）
      let [line, col] = posAt(cur, s);
      for (const tok of typingTokens(ins)) {
        units.push({ kind: "type", change: { range: [line, col, line, col], rangeLength: 0, text: tok }, newline: tok.startsWith("\n"), fast: pace === "fast" });
        const nl = tok.lastIndexOf("\n");
        if (nl === -1) col += tok.length;
        else {
          for (let k = 0; k < tok.length; k++) if (tok.charCodeAt(k) === 10) line++;
          col = tok.length - nl;
        }
      }
      cur = splice(cur, s, s, ins);
      caret = s + ins.length;
    }
  }
  return { text: cur, units, cursor: caret ?? region.start + region.newText.length };
}
