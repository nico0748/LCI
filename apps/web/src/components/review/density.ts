import type { Event, EventOf } from "@lci/core/browser";

/**
 * コードタイムラインのレーン計算。
 * 編集イベントをファイル別・時間バケット別に集計し、「どの時間帯にどのファイルをどれだけ触っていたか」を
 * 4 段の編集量（timeline-layout.ts の editLevel）で塗るための値を返す。重みは変更文字数（削除＋挿入）。
 */

export interface LaneBucket {
  /** バケット開始 t */
  t0: number;
  t1: number;
  /** 変更文字数の合計 */
  chars: number;
  /** 編集イベント数 */
  edits: number;
}

export interface FileLane {
  file: string;
  buckets: LaneBucket[];
  total: number;
}

export function editWeight(e: EventOf<"edit">): number {
  let w = 0;
  for (const c of e.changes) w += c.rangeLength + c.text.length;
  // 空編集（フラッシュのみ）でも 1 回触ったことは残す
  return Math.max(1, w);
}

/** [0, duration] を n 等分したバケットに編集を振り分ける */
export function bucketEdits(events: Event[], duration: number, n: number, files?: string[]): FileLane[] {
  const nb = Math.max(1, Math.floor(n));
  const span = Math.max(1, duration);
  const laneOf = new Map<string, FileLane>();
  const ensure = (file: string): FileLane => {
    let lane = laneOf.get(file);
    if (!lane) {
      lane = {
        file,
        total: 0,
        buckets: Array.from({ length: nb }, (_, i) => ({ t0: (span * i) / nb, t1: (span * (i + 1)) / nb, chars: 0, edits: 0 })),
      };
      laneOf.set(file, lane);
    }
    return lane;
  };
  // 指定順のファイルを先に作っておき、レーン順を安定させる
  for (const f of files ?? []) ensure(f);
  for (const e of events) {
    if (e.type !== "edit") continue;
    const idx = Math.min(nb - 1, Math.max(0, Math.floor((e.t / span) * nb)));
    const lane = ensure(e.file);
    const b = lane.buckets[idx]!;
    const w = editWeight(e);
    b.chars += w;
    b.edits += 1;
    lane.total += w;
  }
  return [...laneOf.values()];
}

/** 全ファイルを 1 本に合算する（モバイルの細いタイムライン用） */
export function mergeLanes(lanes: FileLane[], label = "*"): FileLane | null {
  if (!lanes.length) return null;
  const n = lanes[0]!.buckets.length;
  const buckets = lanes[0]!.buckets.map((b) => ({ t0: b.t0, t1: b.t1, chars: 0, edits: 0 }));
  let total = 0;
  for (const l of lanes) {
    for (let i = 0; i < n; i++) {
      const b = l.buckets[i];
      if (!b) continue;
      buckets[i]!.chars += b.chars;
      buckets[i]!.edits += b.edits;
    }
    total += l.total;
  }
  return { file: label, buckets, total };
}

export function maxBucketChars(lanes: FileLane[]): number {
  let m = 0;
  for (const l of lanes) for (const b of l.buckets) m = Math.max(m, b.chars);
  return m;
}

/** 画面座標 x（0..width）→ t */
export function xToT(x: number, width: number, duration: number): number {
  if (width <= 0) return 0;
  return Math.min(duration, Math.max(0, (x / width) * duration));
}

export function tToX(t: number, width: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(width, Math.max(0, (t / duration) * width));
}
