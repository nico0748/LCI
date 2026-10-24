import type { Event, EventOf, Range, TranscriptSegment } from "./session.ts";

/**
 * 編集イベントからエディタ全文を再構成する。
 * Monaco の IModelContentChange は「変更前の文書に対する範囲」で表現され、
 * 1 イベント内の changes は後ろから適用しても衝突しないよう逆順に並んでいる。
 */

function offsetOf(text: string, line: number, col: number): number {
  // line, col は 1 始まり
  let off = 0;
  let cur = 1;
  while (cur < line) {
    const nl = text.indexOf("\n", off);
    if (nl === -1) return text.length;
    off = nl + 1;
    cur++;
  }
  return Math.min(off + (col - 1), text.length);
}

export function applyEdit(text: string, changes: EventOf<"edit">["changes"]): string {
  // 開始オフセット降順で適用すると前方の位置がずれない
  const sorted = [...changes]
    .map((c) => ({ ...c, start: offsetOf(text, c.range[0], c.range[1]), end: offsetOf(text, c.range[2], c.range[3]) }))
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const c of sorted) out = out.slice(0, c.start) + c.text + out.slice(c.end);
  return out;
}

export interface SnapshotResolver {
  /** snapshot イベントの ref から全文を読む */
  read(ref: string): Promise<string>;
}

/**
 * 時刻 t（含む）時点のファイル全文を返す。
 * 直近の snapshot を起点に、その後の edit を順に適用する。
 */
export async function reconstructFileAt(
  events: Event[],
  fileId: string,
  t: number,
  resolver: SnapshotResolver,
  initial = "",
): Promise<{ text: string; version: number }> {
  let base = initial;
  let version = 0;
  let startIdx = 0;
  // t が最初のスナップショットより前（開始直後）なら、そのスナップショット＝スターターコードを表示する。
  // 最初の edit より前に必ず snapshot が取られるので、編集の取りこぼしは起きない
  const firstSnap = events.find((e): e is EventOf<"snapshot"> => e.type === "snapshot" && e.file === fileId);
  if (firstSnap && firstSnap.t > t) {
    const firstEdit = events.find((e) => e.type === "edit" && e.file === fileId);
    if (!firstEdit || firstEdit.t >= firstSnap.t) return { text: await resolver.read(firstSnap.ref), version: firstSnap.version };
  }
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.t > t) break;
    if (e.type === "snapshot" && e.file === fileId) {
      base = await resolver.read(e.ref);
      version = e.version;
      startIdx = i + 1;
    }
  }
  let text = base;
  for (let i = startIdx; i < events.length; i++) {
    const e = events[i]!;
    if (e.t > t) break;
    if (e.type === "edit" && e.file === fileId) {
      text = applyEdit(text, e.changes);
      version = e.version;
    }
  }
  return { text, version };
}

/** 時刻 t 時点でカーソル・編集が当たっていたシンボル（focus イベントの最新） */
export function focusAt(events: Event[], t: number): EventOf<"focus"> | undefined {
  let last: EventOf<"focus"> | undefined;
  for (const e of events) {
    if (e.t > t) break;
    if (e.type === "focus") last = e;
  }
  return last;
}

/** [t0, t1] に含まれる編集イベントの行範囲を 1 つにまとめる */
export function editedLinesBetween(events: Event[], fileId: string, t0: number, t1: number): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of events) {
    if (e.t < t0) continue;
    if (e.t > t1) break;
    if (e.type !== "edit" || e.file !== fileId) continue;
    for (const c of e.changes) {
      lo = Math.min(lo, c.range[0]);
      const added = c.text.split("\n").length - 1;
      hi = Math.max(hi, c.range[2] + added);
    }
  }
  return lo === Infinity ? null : [lo, hi];
}

/** 発話セグメントと、その時間帯に起きた編集を束ねたタイムライン行 */
export interface TimelineRow {
  t_start: number;
  t_end: number;
  text: string;
  silence: boolean;
  edits: number;
  files: string[];
  focus: string | null;
  lines: [number, number] | null;
}

export function buildTimeline(segments: TranscriptSegment[], events: Event[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const edits = events.filter((e): e is EventOf<"edit"> => e.type === "edit");
  for (const s of segments) {
    const inRange = edits.filter((e) => e.t >= s.t_start && e.t <= s.t_end);
    const files = [...new Set(inRange.map((e) => e.file))];
    const f = focusAt(events, s.t_end);
    const lines = files[0] ? editedLinesBetween(events, files[0], s.t_start, s.t_end) : null;
    rows.push({
      t_start: s.t_start,
      t_end: s.t_end,
      text: s.text,
      silence: !s.text.trim(),
      edits: inRange.length,
      files,
      focus: f?.symbol ? f.symbol.path.join(" > ") : null,
      lines,
    });
  }
  return rows;
}

export function fmtT(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function rangeToString(r: Range): string {
  return `${r[0]}:${r[1]}-${r[2]}:${r[3]}`;
}
