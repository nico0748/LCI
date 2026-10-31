/**
 * 文字列の小道具（ブラウザでも動く純関数だけ）。
 * 位置は Monaco と同じ 1 始まりの [行, 列]。列は UTF-16 単位（core/session.ts の Range と同じ）。
 */

export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

type Segmenter = { segment(s: string): Iterable<{ segment: string; index: number }> };
let segmenter: Segmenter | null | undefined;
function getSegmenter(): Segmenter | null {
  if (segmenter === undefined) {
    const I = (globalThis as { Intl?: { Segmenter?: new (loc: string, o: { granularity: "grapheme" }) => Segmenter } }).Intl;
    segmenter = I?.Segmenter ? new I.Segmenter("ja", { granularity: "grapheme" }) : null;
  }
  return segmenter;
}

/** 書記素（見た目の 1 文字）に分ける。Intl.Segmenter が無ければコードポイント単位（サロゲートペアは割らない） */
export function graphemes(s: string): string[] {
  if (!s) return [];
  const seg = getSegmenter();
  if (seg) return Array.from(seg.segment(s), (x) => x.segment);
  return Array.from(s);
}

/** 書記素の境界（UTF-16 オフセット。0 と length を含む） */
export function graphemeBoundaries(s: string): Set<number> {
  const out = new Set<number>([0]);
  let off = 0;
  for (const g of graphemes(s)) {
    off += g.length;
    out.add(off);
  }
  return out;
}

/** オフセット → [行, 列]（1 始まり） */
export function posAt(text: string, offset: number): [number, number] {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return [line, end - lineStart + 1];
}

export function rangeOf(text: string, start: number, end: number): [number, number, number, number] {
  const a = posAt(text, start);
  const b = posAt(text, end);
  return [a[0], a[1], b[0], b[1]];
}

/** needle の出現位置（重なりも数える）。一意性の判定に使う */
export function occurrences(text: string, needle: string, max = 50): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = text.indexOf(needle);
  while (i !== -1 && out.length < max) {
    out.push(i);
    i = text.indexOf(needle, i + 1);
  }
  return out;
}

export function lineOf(text: string, offset: number): number {
  return posAt(text, offset)[0];
}

/** 行番号付き（`   5| ...`）。from/to は 1 始まりで両端を含む */
export function numberLines(text: string, from = 1, to = Number.POSITIVE_INFINITY): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = Math.max(1, from); i <= Math.min(lines.length, to); i++) out.push(`${String(i).padStart(4, " ")}| ${lines[i - 1]}`);
  return out.join("\n");
}

/** 指定行の前後 pad 行を行番号付きで返す。複数の中心は「…」でつなぐ */
export function numberedWindows(text: string, centers: number[], pad = 3, cap = 120): string {
  const total = text.split("\n").length;
  if (total <= cap && centers.length === 0) return numberLines(text);
  if (centers.length === 0) return numberLines(text, 1, cap) + (total > cap ? `\n …（残り ${total - cap} 行）` : "");
  const spans: [number, number][] = [];
  for (const c of [...centers].sort((a, b) => a - b)) {
    const s: [number, number] = [Math.max(1, c - pad), Math.min(total, c + pad)];
    const last = spans[spans.length - 1];
    if (last && s[0] <= last[1] + 1) last[1] = Math.max(last[1], s[1]);
    else spans.push(s);
  }
  return spans.map(([a, b]) => numberLines(text, a, b)).join("\n …\n");
}

/** 字幕・読みを文に分ける（句点・疑問符・感嘆符の後ろで切る） */
export function splitSentences(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of s) {
    buf += ch;
    if (/[。！？!?]/.test(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** 決定的な JSON（キーを並べ替える）。digest の材料 */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}
