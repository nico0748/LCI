import { promises as fs } from "node:fs";
import path from "node:path";
import { extractTerms, type ProblemMeta, type Recorder, type TranscriptSegment } from "@lci/core";
import { exec } from "./ffmpeg.ts";

/**
 * whisper.cpp（whisper-cli）連携。
 * - 時刻は「メディア時間（音声先頭=0）」で受け取り、`t = t_rec_start + ms * scale` でセッション時刻に写像する（FR-C-21/41/44）。
 * - 元の start_ms/end_ms は捨てない（再計算用）。
 * - フィラー・無音はここで付与し、評価側（metrics）が沈黙時間を使えるようにする（FR-C-25）。
 */

/** whisper.cpp `-oj` / `-ojf` の JSON 出力（必要な部分のみ） */
export interface WhisperJson {
  result?: { language?: string };
  params?: { model?: string; language?: string };
  model?: { type?: string };
  transcription: {
    timestamps?: { from: string; to: string };
    offsets: { from: number; to: number };
    text: string;
    tokens?: { text: string; offsets?: { from: number; to: number }; p?: number; id?: number }[];
  }[];
}

/** 文字起こし上のフィラー（採点には使わない。参考値のみ。要件書 03 §2.4） */
export const FILLER_RE = /^(えー*っ?と?|ええと|あのー*|そのー*|まあー*|まー+|うーん+|んー+|あー+|はい|うん)+$/;

export function isFiller(text: string): boolean {
  const t = text.replace(/[、。,.!?！？…\s　]/g, "");
  return t.length > 0 && FILLER_RE.test(t);
}

/** Whisper が無音区間で出しがちな定型幻覚（要件書 01 §6.2）。単独セグメントのときだけ落とす */
const HALLUCINATION_RE = /^(ご視聴ありがとうございました|ご清聴ありがとうございました|チャンネル登録(お願いします)?|お疲れ様でした|字幕.*by.*)[。！!]?$/;

export function mapMediaToSession(ms: number, rec: Pick<Recorder, "t_rec_start" | "scale"> | undefined): number {
  const start = rec?.t_rec_start ?? 0;
  const scale = rec?.scale ?? 1;
  return Math.round(start + ms * scale);
}

export interface SegmentsOptions {
  /** この長さ以上の間隔を無音セグメントとして挿入する */
  silenceGapMs?: number;
  /** 既知の幻覚フレーズを落とすか */
  dropHallucinations?: boolean;
}

/** whisper.cpp JSON → core Transcript のセグメント列 */
export function whisperJsonToSegments(
  json: WhisperJson,
  rec: Pick<Recorder, "t_rec_start" | "scale"> | undefined,
  opts: SegmentsOptions = {},
): TranscriptSegment[] {
  const gap = opts.silenceGapMs ?? 3000;
  const drop = opts.dropHallucinations ?? true;
  const out: TranscriptSegment[] = [];
  let id = 0;
  let cursor = 0;
  const push = (seg: Omit<TranscriptSegment, "id" | "t_start" | "t_end">) => {
    out.push({ ...seg, id: ++id, t_start: mapMediaToSession(seg.start_ms, rec), t_end: mapMediaToSession(seg.end_ms, rec) });
  };
  for (const raw of json.transcription ?? []) {
    const text = (raw.text ?? "").trim();
    if (!text) continue;
    if (drop && HALLUCINATION_RE.test(text)) continue;
    const start_ms = raw.offsets.from;
    const end_ms = Math.max(raw.offsets.to, start_ms);
    if (start_ms - cursor >= gap) {
      push({ start_ms: cursor, end_ms: start_ms, text: "", silence_ms: start_ms - cursor, is_filler: false, words: [] });
    }
    // トークンは特殊トークン（[_BEG_], [_TT_123] など）を除く。p があれば平均 log 確率を出す
    const toks = (raw.tokens ?? []).filter((t) => t.text && !t.text.startsWith("[_") && t.offsets);
    const words = toks.map((t) => ({ w: t.text.trim(), start_ms: t.offsets!.from, end_ms: t.offsets!.to })).filter((w) => w.w);
    const ps = toks.map((t) => t.p).filter((p): p is number => typeof p === "number" && p > 0);
    const avg_logprob = ps.length ? Math.round((ps.reduce((a, p) => a + Math.log(p), 0) / ps.length) * 1000) / 1000 : undefined;
    push({ start_ms, end_ms, text, is_filler: isFiller(text), words, ...(avg_logprob !== undefined ? { avg_logprob } : {}) });
    cursor = Math.max(cursor, end_ms);
  }
  return out;
}

/**
 * initial_prompt（語彙ヒント, FR-C-22）。問題の talking_points / requirements から英語識別子とカタカナ語を集める。
 * whisper の prompt は約 224 トークンまでしか効かないので 200 文字程度で打ち切る。
 */
export function buildInitialPrompt(meta: Pick<ProblemMeta, "title" | "talking_points" | "requirements" | "tags">, extra: string[] = []): string {
  const terms = new Set<string>();
  const add = (t: string) => {
    if (t && t.length >= 2) terms.add(t);
  };
  for (const tp of meta.talking_points) extractTerms(tp.text).forEach(add);
  for (const r of meta.requirements) extractTerms(r.label).forEach(add);
  for (const t of [...meta.tags.nfr, ...meta.tags.security]) add(t);
  for (const t of extra) add(t);
  // 面接で頻出の汎用語。問題固有語の後ろに置く
  for (const t of ["fetch", "async", "await", "Promise", "Map", "Set", "JSON", "DOM", "API", "キャッシュ", "リクエスト", "レスポンス"]) add(t);
  let s = meta.title ? `${meta.title}。` : "";
  for (const t of terms) {
    if (s.length + t.length + 1 > 200) break;
    s += `${t}、`;
  }
  return s.replace(/、$/, "");
}

export interface RunWhisperInput {
  bin: string;
  model: string;
  wav: string;
  /** 出力ファイルのプレフィックス（`<prefix>.json` が書かれる） */
  outPrefix: string;
  initialPrompt?: string;
  language?: string;
  threads?: number;
  timeoutMs?: number;
}

export async function runWhisper(input: RunWhisperInput): Promise<{ json: WhisperJson; elapsed_ms: number; stderr: string }> {
  await fs.mkdir(path.dirname(input.outPrefix), { recursive: true });
  const args = [
    "-m",
    input.model,
    "-f",
    input.wav,
    "-l",
    input.language ?? "ja",
    "-oj",
    "-ojf",
    "-of",
    input.outPrefix,
    "-ml",
    "0",
    "-np",
  ];
  if (input.initialPrompt) args.push("--prompt", input.initialPrompt);
  if (input.threads) args.push("-t", String(input.threads));
  const r = await exec(input.bin, args, { timeoutMs: input.timeoutMs ?? 60 * 60_000 });
  const jsonPath = `${input.outPrefix}.json`;
  let raw: string;
  try {
    raw = await fs.readFile(jsonPath, "utf8");
  } catch {
    throw new Error(`whisper-cli が JSON を出力しませんでした (exit ${r.code}): ${r.stderr.slice(-800)}`);
  }
  if (r.code !== 0) throw new Error(`whisper-cli が異常終了しました (exit ${r.code}): ${r.stderr.slice(-800)}`);
  const json = JSON.parse(raw) as WhisperJson;
  if (!Array.isArray(json.transcription)) throw new Error("whisper-cli の JSON に transcription がありません");
  return { json, elapsed_ms: r.elapsed_ms, stderr: r.stderr };
}
