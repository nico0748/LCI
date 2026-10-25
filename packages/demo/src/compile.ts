import type { Axis, Event, Language, Range, TranscriptSegment } from "@lci/core/browser";
import type { AudioManifest, Chapter, ChapterPhase, DemoDraft, DemoScript, RunSnapshot, Step } from "./schema.ts";
import type { CompiledDemo, CompiledStep } from "./types.ts";
import { applyOp, findUnique, type OpFailure } from "./ops.ts";
import { humanizeEdit, type Unit } from "./humanize.ts";
import { buildReading } from "./readings.ts";
import { normalizeNewlines, rangeOf, splitSentences } from "./text.ts";

/**
 * 台本 → 時刻つきイベント列（02 §4、00 D4/D5）。純関数なのでブラウザでも同じ結果になる。
 * 時刻は Claude に書かせず、ここで「ナレーションの長さ × 打鍵が説明に収まる速さ」から決定的に割り付ける。
 * 乱数の揺らぎは入れない（D4: シーク結果を毎回同じにする）。
 */

export const TIMING = {
  /** 推定の読み速度（読み文字/秒）。声ごとの較正値（calibration）があれば上書き */
  readingCps: 6.5,
  sayBaseMs: 250,
  commaMs: 120,
  periodMs: 300,
  /** D4: 1x で 8〜25 字/秒 */
  typeCpsMin: 8,
  typeCpsMax: 25,
  fastCps: 60,
  newlineFactor: 1.5,
  backspaceMs: 70,
  /** 範囲選択を見せてから消すまで */
  selectMs: 330,
  deleteMs: 100,
  jumpMs: 200,
  instantMs: 120,
  /** code_timing=with: 最初の文を言い終えてから打つ（clamp） */
  leadMinMs: 800,
  leadMaxMs: 5000,
  afterGapMs: 300,
  /** 説明の終わりの少し前に打ち終える */
  typingTailMs: 300,
  runGapMs: 300,
  runMinMs: 600,
  runMaxMs: 2500,
  /** 結果を読む間 */
  runDwellMs: 800,
  pauseMs: 450,
  chapterPauseMs: 1200,
  /** 1 イベントの間隔の下限（速いときは書記素をまとめる） */
  minEventGapMs: 33,
  /** D5: 無発話の打鍵 3 秒超で警告、8 秒超で保存しない */
  silentWarnMs: 3000,
  silentErrorMs: 8000,
} as const;

/** 章の軸が空のときの既定（01 §2 の表） */
export const DEFAULT_AXES: Record<ChapterPhase, Axis[]> = {
  requirements: ["R1_requirements"],
  plan: ["R2_plan", "R3_tradeoffs"],
  implement: ["R4_correctness", "R7_sync"],
  test: ["R5_testing"],
  detour: ["R8_attitude", "R5_testing"],
  review: ["R6_time", "R2_plan"],
};

/** 読みから発話の長さを推定する（ms） */
export function estimateSayMs(reading: string, cps: number = TIMING.readingCps): number {
  const chars = reading.replace(/[\s、。，．,.!?！？「」『』（）()・:：;；]/g, "").length;
  const commas = (reading.match(/[、，,]/g) ?? []).length;
  const periods = (reading.match(/[。！？!?]/g) ?? []).length;
  return Math.round(TIMING.sayBaseMs + (chars * 1000) / cps + commas * TIMING.commaMs + periods * TIMING.periodMs);
}

export function stepReading(step: Step, glossary: DemoDraft["glossary"]): string | null {
  return step.say ? buildReading(step.say.text, step.say.reading, glossary) : null;
}

export interface StepOpError extends OpFailure {
  step_id: string;
  path: string;
}

interface StepPlan {
  step: Step;
  index: number;
  chapter: Chapter;
  before: string;
  after: string;
  units: Unit[];
  highlight?: Range;
  reading: string | null;
}

export interface PlanResult {
  plans: StepPlan[];
  final: string;
  opErrors: StepOpError[];
  highlightErrors: { step_id: string; path: string; count: number; context: string }[];
}

/** 操作を順に当て、各ステップの打鍵列と keyframe を作る（P3） */
export function planSteps(draft: DemoDraft, initial: string): PlanResult {
  const chapters = new Map(draft.chapters.map((c) => [c.id, c]));
  const plans: StepPlan[] = [];
  const opErrors: StepOpError[] = [];
  const highlightErrors: PlanResult["highlightErrors"] = [];
  let text = normalizeNewlines(initial);
  let cursor: number | null = null;
  draft.steps.forEach((step, index) => {
    const before = text;
    const units: Unit[] = [];
    step.code.forEach((op, k) => {
      const r = applyOp(text, op);
      if (!r.ok) {
        if (opErrors.length < 10) {
          const cascade = opErrors.length > 0 ? "（先に失敗した操作の影響かもしれません。先のエラーから直してください）" : "";
          opErrors.push({ ...r.error, hint: r.error.hint + cascade, step_id: step.id, path: `steps[${index}].code[${k}]${op.op === "replace" ? ".old" : ""}` });
        }
        return; // 失敗した操作は飛ばして続ける（1 往復で複数直せるように）
      }
      const h = humanizeEdit(text, r.region, op.pace, cursor);
      units.push(...h.units);
      text = h.text;
      cursor = h.cursor;
    });
    let highlight: Range | undefined;
    if (step.highlight) {
      const f = findUnique(text, step.highlight.find);
      if ("start" in f) highlight = rangeOf(text, f.start, f.end);
      else highlightErrors.push({ step_id: step.id, path: `steps[${index}].highlight.find`, count: f.count, context: "" });
    }
    plans.push({
      step,
      index,
      chapter: chapters.get(step.chapter) ?? { id: step.chapter, title: step.chapter, phase: "implement", axes: [] },
      before,
      after: text,
      units,
      highlight,
      reading: stepReading(step, draft.glossary),
    });
  });
  return { plans, final: text, opErrors, highlightErrors };
}

export interface StepTimingReport {
  id: string;
  chapter: string;
  t0: number;
  t1: number;
  say_ms: number;
  say_measured: boolean;
  typing_ms: number;
  /** 打鍵の速さ（字/秒、1x） */
  cps: number | null;
  /** 説明が終わったあとも打っている時間（無発話の打鍵） */
  silent_typing_ms: number;
  /** 打つ書記素の数（pace=type） */
  typed_chars: number;
}

export interface CompileInput {
  draft: DemoDraft;
  initial: string;
  file: { path: string; language: Language };
  /** step_id → 保存時に実行した結果 */
  runs?: Record<string, RunSnapshot>;
  manifest?: AudioManifest | null;
  /** 推定の読み速度（読み文字/秒） */
  readingCps?: number;
}

export interface CompileOutput {
  compiled: CompiledDemo;
  timings: StepTimingReport[];
  final: string;
  opErrors: StepOpError[];
  highlightErrors: PlanResult["highlightErrors"];
}

const PLACEHOLDER_RUN: RunSnapshot = { verdict: "IE", duration_ms: 0, passed: 0, total: 0, cases: [], stderr_head: "未実行（検証前）" };

/** 打鍵列の所要時間のうち、速さ（cps）に依存しない部分と依存する重み */
function unitCost(units: Unit[]): { fixedMs: number; typedWeight: number; typedChars: number } {
  let fixedMs = 0;
  let typedWeight = 0;
  let typedChars = 0;
  const fastMs = 1000 / TIMING.fastCps;
  for (const u of units) {
    switch (u.kind) {
      case "jump":
        fixedMs += TIMING.jumpMs;
        break;
      case "select":
        fixedMs += TIMING.selectMs;
        break;
      case "delete":
        fixedMs += TIMING.deleteMs;
        break;
      case "backspace":
        fixedMs += TIMING.backspaceMs;
        break;
      case "instant":
        fixedMs += TIMING.instantMs;
        break;
      case "type":
        if (u.fast) fixedMs += fastMs * (u.newline ? 1 + TIMING.newlineFactor : 1);
        else {
          typedWeight += u.newline ? 1 + TIMING.newlineFactor : 1;
          typedChars++;
        }
        break;
    }
  }
  return { fixedMs, typedWeight, typedChars };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 台本 → CompiledDemo。操作の失敗があっても（飛ばして）最後まで組み立てる */
export function compileDraft(input: CompileInput): CompileOutput {
  const { draft } = input;
  const plan = planSteps(draft, input.initial);
  const segByStep = new Map((input.manifest?.segments ?? []).map((s) => [s.step_id, s]));
  const cpsRead = input.readingCps ?? TIMING.readingCps;

  const events: Event[] = [];
  let seq = 0;
  let version = 1;
  const push = (e: Record<string, unknown> & { t: number; type: Event["type"] }) => {
    events.push({ ...e, t: Math.round(e.t), seq: ++seq } as Event);
  };
  const F = "f1";
  push({ t: 0, type: "file_open", file: F, language: input.file.language });

  const steps: CompiledStep[] = [];
  const timings: StepTimingReport[] = [];
  const segments: TranscriptSegment[] = [];
  const keyframes: Record<string, string> = {};
  let t = 0;
  let measuredAll = true;
  let prevChapter: string | null = null;

  plan.plans.forEach((p, idx) => {
    const { step } = p;
    const T = t;
    const next = plan.plans[idx + 1];
    if (step.chapter !== prevChapter) push({ t: T, type: "marker", label: `chapter:${step.chapter}` });
    prevChapter = step.chapter;
    keyframes[`kf:${step.id}`] = p.before;
    push({ t: T, type: "snapshot", file: F, version, ref: `kf:${step.id}`, sha1: "" });

    // 発話の長さ（実測があれば実測）
    let dN = 0;
    let measured = false;
    let audioKey: string | undefined;
    if (step.say && p.reading !== null) {
      const seg = segByStep.get(step.id);
      if (seg) {
        dN = seg.duration_ms;
        measured = true;
        audioKey = seg.key;
      } else {
        dN = estimateSayMs(p.reading, cpsRead);
        measuredAll = false;
      }
    }

    // 打ち始め（説明先行、R7）
    let lead = 0;
    if (step.say && p.units.length) {
      if (step.code_timing === "before") lead = 0;
      else if (step.code_timing === "after") lead = dN + TIMING.afterGapMs;
      else {
        const sents = splitSentences(p.reading ?? step.say.text);
        const total = sents.reduce((a, s) => a + s.length, 0) || 1;
        const ratio = sents.length > 1 ? (sents[0]!.length / total) : 0.35;
        lead = Math.min(dN, clamp(dN * ratio, TIMING.leadMinMs, TIMING.leadMaxMs));
      }
    }

    // 打鍵の速さ: 説明が覆える時間に収まる速さで打つ（8〜25 字/秒に収める）
    const cost = unitCost(p.units);
    const W = Math.max(0, dN - lead - TIMING.typingTailMs);
    const cps = cost.typedWeight > 0 ? clamp((cost.typedWeight * 1000) / Math.max(W - cost.fixedMs, 1), TIMING.typeCpsMin, TIMING.typeCpsMax) : null;
    const charMs = cps ? 1000 / cps : 0;
    const fastMs = 1000 / TIMING.fastCps;

    const typing0 = T + lead;
    let tc = typing0;
    // 間隔が minEventGapMs 未満の打鍵はまとめる（連続した挿入なので先頭の範囲に連結してよい）
    let pending: { t: number; range: Range; text: string; acc: number } | null = null;
    const flushPending = () => {
      if (!pending) return;
      push({ t: pending.t, type: "edit", file: F, version: ++version, changes: [{ range: pending.range, rangeLength: 0, text: pending.text }], undo: false, flush: false });
      pending = null;
    };
    for (const u of p.units) {
      if (u.kind === "type") {
        const c = (u.fast ? fastMs : charMs) * (u.newline ? 1 + TIMING.newlineFactor : 1);
        if (pending && pending.acc < TIMING.minEventGapMs) {
          pending.text += u.change.text;
          pending.acc += c;
        } else {
          flushPending();
          pending = { t: tc, range: u.change.range, text: u.change.text, acc: c };
        }
        tc += c;
        continue;
      }
      flushPending();
      switch (u.kind) {
        case "jump":
          push({ t: tc, type: "cursor", file: F, pos: u.pos, sel: null });
          tc += TIMING.jumpMs;
          break;
        case "select":
          push({ t: tc, type: "cursor", file: F, pos: u.pos, sel: u.sel });
          tc += TIMING.selectMs;
          break;
        case "delete":
        case "backspace":
        case "instant":
          push({ t: tc, type: "edit", file: F, version: ++version, changes: [u.change], undo: false, flush: false });
          tc += u.kind === "delete" ? TIMING.deleteMs : u.kind === "backspace" ? TIMING.backspaceMs : TIMING.instantMs;
          break;
      }
    }
    flushPending();
    const typingEnd = p.units.length ? tc : T;
    const sayEnd = T + dN;

    let run: CompiledStep["run"];
    let tailEnd = Math.max(sayEnd, typingEnd);
    if (step.run) {
      const result = input.runs?.[step.id] ?? PLACEHOLDER_RUN;
      const rt = Math.max(sayEnd, typingEnd) + TIMING.runGapMs;
      const shown = rt + clamp(result.duration_ms || 1200, TIMING.runMinMs, TIMING.runMaxMs);
      run = { t: Math.round(rt), shown_until: Math.round(shown), mode: step.run.mode, result };
      if (step.run.stdin !== undefined) run.stdin = step.run.stdin;
      if (step.run.expect_output !== undefined) run.expect_output = step.run.expect_output;
      push({
        t: rt,
        type: "run",
        run_id: `demo-${step.id}`,
        mode: step.run.mode === "judge" ? "judge" : "run",
        file: F,
        language: input.file.language,
        verdict: result.verdict,
        duration_ms: result.duration_ms,
        ref: `run:${step.id}`,
      });
      tailEnd = shown + TIMING.runDwellMs;
    }
    const chapterBreak = !next || next.step.chapter !== step.chapter;
    const t1 = tailEnd + (step.pause_after_ms ?? (chapterBreak ? TIMING.chapterPauseMs : TIMING.pauseMs));

    const cs: CompiledStep = { id: step.id, chapter: step.chapter, t0: Math.round(T), t1: Math.round(t1), covers: [...step.covers] };
    if (step.say) {
      cs.say = { t0: Math.round(T), t1: Math.round(sayEnd), text: step.say.text };
      if (audioKey) cs.say.audio_key = audioKey;
      segments.push({
        id: segments.length + 1,
        start_ms: Math.round(T),
        end_ms: Math.round(sayEnd),
        t_start: Math.round(T),
        t_end: Math.round(sayEnd),
        text: step.say.text,
        is_filler: false,
        words: [],
      });
    }
    if (p.units.length) cs.typing = { t0: Math.round(typing0), t1: Math.round(typingEnd) };
    if (run) cs.run = run;
    if (p.highlight) cs.highlight = { range: p.highlight };
    steps.push(cs);
    timings.push({
      id: step.id,
      chapter: step.chapter,
      t0: Math.round(T),
      t1: Math.round(t1),
      say_ms: Math.round(dN),
      say_measured: measured,
      typing_ms: Math.round(typingEnd - typing0),
      cps: cps === null ? null : Math.round(cps * 10) / 10,
      silent_typing_ms: Math.max(0, Math.round(typingEnd - sayEnd)),
      typed_chars: cost.typedChars,
    });
    t = t1;
  });

  const chapters: CompiledDemo["chapters"] = [];
  for (const c of draft.chapters) {
    const own = steps.filter((s) => s.chapter === c.id);
    if (!own.length) continue;
    chapters.push({ id: c.id, title: c.title, phase: c.phase, axes: c.axes.length ? [...c.axes] : [...DEFAULT_AXES[c.phase]], t0: own[0]!.t0, t1: own[own.length - 1]!.t1 });
  }
  chapters.sort((a, b) => a.t0 - b.t0);

  const hasSay = plan.plans.some((p) => p.step.say);
  const compiled: CompiledDemo = {
    duration: Math.round(t),
    file: { file_id: "f1", path: input.file.path, language: input.file.language },
    initial: normalizeNewlines(input.initial),
    events,
    narration: { schema_version: "1.0", recorder: "demo", engine: input.manifest ? `tts:${input.manifest.engine}` : "estimate", segments },
    steps,
    chapters,
    keyframes,
    timing_source: hasSay && measuredAll && input.manifest ? "measured" : "estimated",
  };
  return { compiled, timings, final: plan.final, opErrors: plan.opErrors, highlightErrors: plan.highlightErrors };
}

/**
 * 保存済みの台本（検証済み）＋音声マニフェスト → 再生用。プレイヤーとサーバの両方がこれを呼ぶ。
 * initial は台本に記録した基底テキスト（file.base_text）。古い台本で無い場合は呼び出し側が渡す。
 */
export function compileDemo(script: DemoScript, manifest?: AudioManifest | null, initial?: string): CompiledDemo {
  return compileDraft({
    draft: script.draft,
    initial: script.file.base_text ?? initial ?? "",
    file: { path: script.file.path, language: script.language },
    runs: script.validation.runs,
    manifest: manifest ?? null,
  }).compiled;
}
