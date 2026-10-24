import { promises as fs } from "node:fs";
import path from "node:path";
import type { Event, EventOf, Metrics, Recorder } from "@lci/core";
import { extractFrame } from "./ffmpeg.ts";

/**
 * 画面録画からの「出来事駆動」キーフレーム抽出（要件書 03 §6.1 方式 A）。
 * 1 fps で全部渡すのではなく、実行直後・方針変更・沈黙開始・編集バースト境界・終了時だけを 8–16 枚切り出す。
 * 既定は screen。Web カメラは allowCamFrames のときだけ（03 §6.2）。
 */

export interface FrameEntry {
  /** セッション時刻 ms */
  t: number;
  /** セッションディレクトリからの相対パス */
  file: string;
  reason: string;
  source: "screen" | "cam";
  media_s: number;
}

export interface FrameIndex {
  schema_version: "1.0";
  source: "screen" | "cam";
  frames: FrameEntry[];
}

export const FRAME_INDEX_REL = path.posix.join("derived", "frames", "index.json");

interface Candidate {
  t: number;
  reason: string;
  priority: number;
}

/** 編集イベントを gapMs 以上の間隔で区切ったバースト */
export function editBursts(events: Event[], gapMs = 10_000): { t0: number; t1: number; count: number }[] {
  const edits = events.filter((e): e is EventOf<"edit"> => e.type === "edit");
  const out: { t0: number; t1: number; count: number }[] = [];
  for (const e of edits) {
    const last = out[out.length - 1];
    if (last && e.t - last.t1 <= gapMs) {
      last.t1 = e.t;
      last.count++;
    } else out.push({ t0: e.t, t1: e.t, count: 1 });
  }
  return out;
}

export function pickKeyframeTimes(input: { events: Event[]; metrics: Metrics | null; ended_t: number; cap?: number; minGapMs?: number }): {
  t: number;
  reason: string;
}[] {
  const cap = input.cap ?? 16;
  const minGap = input.minGapMs ?? 5000;
  const clamp = (t: number) => Math.min(Math.max(0, t), Math.max(0, input.ended_t - 500));
  const cands: Candidate[] = [];
  for (const e of input.events) {
    // 実行結果が画面に出るまで少し待つ
    if (e.type === "run") cands.push({ t: clamp(e.t + 2000), reason: `実行直後 (${e.mode}${e.verdict ? ` / ${e.verdict}` : ""})`, priority: 1 });
  }
  for (const d of input.metrics?.direction_changes ?? []) cands.push({ t: clamp(d.t), reason: `方針変更 (${d.kind})`, priority: 2 });
  for (const s of input.metrics?.silence_gt15s ?? []) cands.push({ t: clamp(s.t0 + 1000), reason: `沈黙開始 (${s.dur_s}s, 編集${s.editing ? "あり" : "なし"})`, priority: 3 });
  const bursts = editBursts(input.events);
  for (const b of bursts) {
    if (b.count < 5) continue;
    cands.push({ t: clamp(b.t0), reason: "編集バースト開始", priority: 4 });
    cands.push({ t: clamp(b.t1), reason: "編集バースト終了", priority: 4 });
  }
  cands.push({ t: clamp(input.ended_t - 1000), reason: "終了時", priority: 0 });
  const first = bursts[0];
  if (first) cands.push({ t: clamp(first.t0), reason: "最初の編集", priority: 2 });

  cands.sort((a, b) => a.priority - b.priority || a.t - b.t);
  const picked: Candidate[] = [];
  for (const c of cands) {
    if (picked.length >= cap) break;
    if (picked.some((p) => Math.abs(p.t - c.t) < minGap)) continue;
    picked.push(c);
  }
  return picked.sort((a, b) => a.t - b.t).map(({ t, reason }) => ({ t, reason }));
}

export async function extractKeyframes(input: {
  ffmpeg: string;
  sessionDir: string;
  recorder: Recorder;
  times: { t: number; reason: string }[];
  maxWidth?: number;
}): Promise<FrameIndex> {
  const { recorder } = input;
  const src = path.join(input.sessionDir, recorder.file);
  const outDir = path.join(input.sessionDir, "derived", "frames");
  await fs.mkdir(outDir, { recursive: true });
  const start = recorder.t_rec_start ?? 0;
  const scale = recorder.scale ?? 1;
  const durS = recorder.media_duration_ms ? recorder.media_duration_ms / 1000 : null;
  const frames: FrameEntry[] = [];
  for (const { t, reason } of input.times) {
    // セッション時刻 → メディア時間（t = t_rec_start + media_ms * scale の逆算）
    const media_s = (t - start) / scale / 1000;
    if (media_s < 0) continue;
    if (durS !== null && media_s > durS) continue;
    const file = path.posix.join("derived", "frames", `${Math.round(t)}.jpg`);
    const r = await extractFrame(input.ffmpeg, src, media_s, path.join(input.sessionDir, file), input.maxWidth ?? 1280);
    if (r.code !== 0) continue;
    try {
      const st = await fs.stat(path.join(input.sessionDir, file));
      if (st.size === 0) continue;
    } catch {
      continue;
    }
    frames.push({ t: Math.round(t), file, reason, source: recorder.id, media_s: Math.round(media_s * 1000) / 1000 });
  }
  const index: FrameIndex = { schema_version: "1.0", source: recorder.id, frames };
  await fs.writeFile(path.join(input.sessionDir, FRAME_INDEX_REL), JSON.stringify(index, null, 2));
  return index;
}

export async function readFrameIndex(sessionDir: string): Promise<FrameIndex | null> {
  try {
    const j = JSON.parse(await fs.readFile(path.join(sessionDir, FRAME_INDEX_REL), "utf8")) as FrameIndex;
    return Array.isArray(j.frames) ? j : null;
  } catch {
    return null;
  }
}
