import { computeMetrics, detectTalkingPoints, type Metrics, type ProblemBody, type ProblemMeta, type TranscriptSegment } from "@lci/core/browser";
import { LIMITS, type DemoDraft } from "./schema.ts";
import type { CompiledDemo } from "./types.ts";
import { TIMING, estimateSayMs, type StepTimingReport } from "./compile.ts";
import { buildReading, needsReading, unreadableParts } from "./readings.ts";
import { splitSentences } from "./text.ts";

/**
 * 検証の純粋な段（02 §5 の P2・P5〜P8、01 FR-D-30〜37）。node に依存しない。
 * 実行（P4）と入口（P0/P1）は validate.ts。
 */

export interface DemoIssue {
  code: string;
  message: string;
  hint?: string;
  step_id?: string;
  path?: string;
  context?: { before_numbered?: string };
}

export interface CheckContext {
  meta: ProblemMeta;
  body?: ProblemBody;
  judgeKind: "stdio" | "unit";
}

const PHASE_LABEL = { requirements: "要件確認", plan: "方針宣言", implement: "実装", test: "検証", detour: "寄り道", review: "見直し" } as const;

/** covers で参照できる id: talking_points / requirements / red_flags（rf1, rf2, …） */
export function coverIds(meta: ProblemMeta): { tp: string[]; req: string[]; rf: string[] } {
  return {
    tp: meta.talking_points.map((t) => t.id),
    req: meta.requirements.map((r) => r.id),
    rf: meta.rubric_hints.red_flags.map((_, i) => `rf${i + 1}`),
  };
}

/** P2: 参照整合と章の構成（FR-D-30, 36, 37 の構造部分） */
export function checkStructure(draft: DemoDraft, ctx: CheckContext): { errors: DemoIssue[]; warnings: DemoIssue[] } {
  const errors: DemoIssue[] = [];
  const warnings: DemoIssue[] = [];
  const chapterIdx = new Map<string, number>();
  draft.chapters.forEach((c, i) => {
    if (chapterIdx.has(c.id)) errors.push({ code: "E_DUP_CHAPTER", path: `chapters[${i}].id`, message: `章 id「${c.id}」が重複しています`, hint: "章 id は台本内で一意にしてください" });
    else chapterIdx.set(c.id, i);
  });
  const seenSteps = new Set<string>();
  let lastChapter = -1;
  const used = new Set<string>();
  const ids = coverIds(ctx.meta);
  const known = new Set([...ids.tp, ...ids.req, ...ids.rf]);
  let intentionalFails = 0;
  draft.steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (seenSteps.has(s.id)) errors.push({ code: "E_DUP_STEP", step_id: s.id, path: `${at}.id`, message: `step id「${s.id}」が重複しています`, hint: "step id は台本内で一意にしてください（例: impl-3）" });
    seenSteps.add(s.id);
    const ci = chapterIdx.get(s.chapter);
    if (ci === undefined) {
      errors.push({ code: "E_UNKNOWN_CHAPTER", step_id: s.id, path: `${at}.chapter`, message: `章「${s.chapter}」は chapters にありません`, hint: `chapters[].id のどれか（${[...chapterIdx.keys()].join(", ")}）を書いてください` });
    } else {
      used.add(s.chapter);
      if (ci < lastChapter) errors.push({ code: "E_CHAPTER_ORDER", step_id: s.id, path: `${at}.chapter`, message: `章「${s.chapter}」に戻っています。step は chapters の順に並べてください`, hint: "章をまたいで行き来する場合は、新しい章を足してください" });
      lastChapter = Math.max(lastChapter, ci);
    }
    if (!s.say && s.code.length === 0 && !s.run) errors.push({ code: "E_EMPTY_STEP", step_id: s.id, path: at, message: "say・code・run がどれもありません", hint: "このステップを消すか、ナレーションを足してください" });
    for (const c of s.covers) {
      if (!known.has(c)) warnings.push({ code: "W_UNKNOWN_COVER", step_id: s.id, path: `${at}.covers`, message: `covers の「${c}」は talking_points / requirements / red_flags の id にありません`, hint: `使える id: ${[...known].join(", ")}` });
    }
    if (s.run) {
      if (s.run.mode === "stdin" && s.run.stdin === undefined) errors.push({ code: "E_RUN_STDIN", step_id: s.id, path: `${at}.run.stdin`, message: "mode=stdin なのに stdin がありません", hint: "実行する入力を stdin に書いてください（末尾の改行も含める）" });
      if (s.run.mode !== "stdin" && s.run.stdin !== undefined) warnings.push({ code: "W_RUN_STDIN_IGNORED", step_id: s.id, path: `${at}.run.stdin`, message: `mode=${s.run.mode} では stdin は使いません（問題のテストケースで実行します）` });
      if (s.run.mode === "stdin" && ctx.judgeKind !== "stdio") errors.push({ code: "E_RUN_MODE", step_id: s.id, path: `${at}.run.mode`, message: "unit 問題では mode=stdin を使えません", hint: "mode=sample（テストハーネスを実行）か judge を使ってください" });
      if (s.run.expect_output !== undefined && s.run.mode !== "stdin") warnings.push({ code: "W_EXPECT_OUTPUT_IGNORED", step_id: s.id, path: `${at}.run.expect_output`, message: "expect_output は mode=stdin のときだけ使います" });
      if (s.run.expect !== "AC" && s.run.expect !== "any" && s.run.expect !== "PASS") intentionalFails++;
    }
    if (s.code.length && s.say && s.code_timing === "before") warnings.push({ code: "W_CODE_BEFORE_SAY", step_id: s.id, path: `${at}.code_timing`, message: "code_timing=before は話し始めと同時に打ちます（説明先行 FR-D-33 にならない）", hint: "特別な理由が無ければ with（既定）にしてください" });
  });
  draft.chapters.forEach((c, i) => {
    if (!used.has(c.id)) errors.push({ code: "E_EMPTY_CHAPTER", path: `chapters[${i}]`, message: `章「${c.id}」に step がありません`, hint: "章を消すか、step を足してください" });
  });
  if (intentionalFails > 2) errors.push({ code: "E_TOO_MANY_FAILS", message: `意図的に失敗させる実行が ${intentionalFails} 回あります（上限 2）`, hint: "寄り道は 1 回まで（失敗する実行 → 直す → 通る実行）にしてください" });

  // 章の構成（FR-D-30、D3）
  const n = draft.chapters.length;
  if (n < 4 || n > 7) errors.push({ code: "E_CHAPTER_COUNT", path: "chapters", message: `章が ${n} 個あります。4〜7 個にしてください（FR-D-30）`, hint: "requirements → plan → implement → test →（detour）→ review が基本形です" });
  const phases = draft.chapters.map((c) => c.phase);
  for (const ph of ["requirements", "plan", "implement", "test", "review"] as const) {
    if (!phases.includes(ph)) errors.push({ code: "E_PHASE_MISSING", path: "chapters", message: `phase=${ph}（${PHASE_LABEL[ph]}）の章がありません`, hint: "章は requirements / plan / implement / test / review を少なくとも 1 つずつ持ちます" });
  }
  if (phases.length && phases[0] !== "requirements") errors.push({ code: "E_PHASE_ORDER", path: "chapters[0].phase", message: `最初の章が ${phases[0]} です。requirements（要件確認）から始めてください` });
  if (phases.length && phases[phases.length - 1] !== "review") errors.push({ code: "E_PHASE_ORDER", path: `chapters[${phases.length - 1}].phase`, message: `最後の章が ${phases[phases.length - 1]} です。review（見直し）で終えてください` });
  const firstImpl = phases.indexOf("implement");
  const firstPlan = phases.indexOf("plan");
  if (firstImpl !== -1 && firstPlan !== -1 && firstPlan > firstImpl) errors.push({ code: "E_PHASE_ORDER", path: "chapters", message: "implement の章が plan より前にあります（方針を宣言してから実装する）" });
  phases.forEach((ph, i) => {
    if (i > 0 && (ph === "requirements" || ph === "plan") && phases.slice(0, i).some((x) => x !== "requirements" && x !== "plan"))
      errors.push({ code: "E_PHASE_ORDER", path: `chapters[${i}].phase`, message: `${ph} の章が実装・検証の後にあります`, hint: "requirements と plan は冒頭にまとめてください" });
  });
  const detours = phases.filter((p) => p === "detour").length;
  if (detours > 1) errors.push({ code: "E_DETOUR_COUNT", path: "chapters", message: `寄り道（detour）が ${detours} 回あります。1 回までです（D3）` });

  // FR-D-36: 検証の章に「予告してから実行する」ステップがある
  const testChapters = new Set(draft.chapters.filter((c) => c.phase === "test").map((c) => c.id));
  if (testChapters.size && !draft.steps.some((s) => testChapters.has(s.chapter) && s.run && s.say)) {
    errors.push({ code: "E_TEST_RUN_MISSING", path: "steps", message: "検証（test）の章に、予告してから実行するステップ（say と run を両方持つ step）がありません（FR-D-36）", hint: "例: say「サンプル 1 は 1 2 になるはずです。実行します」＋ run: {mode: \"sample\"}" });
  }
  // FR-D-37: 寄り道の形（失敗する実行 → 直す → 通る実行）
  const detourCh = draft.chapters.find((c) => c.phase === "detour");
  if (detourCh) {
    const ds = draft.steps.filter((s) => s.chapter === detourCh.id);
    const idxFail = draft.steps.findIndex((s) => s.run && s.run.expect !== "AC" && s.run.expect !== "any" && s.run.expect !== "PASS");
    const lastDetourIdx = draft.steps.lastIndexOf(ds[ds.length - 1]!);
    const fixIdx = idxFail === -1 ? -1 : draft.steps.findIndex((s, i) => i > idxFail && s.code.length > 0);
    const passIdx = fixIdx === -1 ? -1 : draft.steps.findIndex((s, i) => i > fixIdx && s.run && (s.run.expect === "AC" || s.run.expect === "PASS"));
    if (idxFail === -1 || fixIdx === -1 || passIdx === -1 || fixIdx > lastDetourIdx) {
      warnings.push({ code: "W_DETOUR_SHAPE", message: "寄り道は「失敗する実行（expect に WA など）→ 直す（code）→ 通る実行（expect AC）」の順にしてください（FR-D-37）" });
    }
    if (!ds.some((s) => s.covers.some((c) => ids.tp.includes(c) || ids.rf.includes(c)))) {
      warnings.push({ code: "W_DETOUR_UNLINKED", message: "寄り道が talking_points / red_flags に結び付いていません（covers に tp* か rf* を書く）", hint: `使える id: ${[...ids.tp, ...ids.rf].join(", ")}` });
    }
  }
  return { errors, warnings };
}

const MARKUP: [RegExp, string][] = [
  [/(^|\n)\s*#{1,6}\s/, "Markdown の見出し"],
  [/```/, "コードブロック"],
  [/https?:\/\//, "URL"],
  [/\[\[|\]\]/, "`[[ ]]`（say の埋め込みコマンド）"],
  [/\*\*|__(?!\w)/, "強調（** や __）"],
  [/\[[^\]]+\]\([^)]+\)/, "Markdown のリンク"],
  [/<\/?[a-zA-Z][^>]*>/, "HTML タグ"],
];

/** P8: ナレーションの lint（FR-D-35、02 §5 P8） */
export function lintNarration(draft: DemoDraft): { errors: DemoIssue[]; warnings: DemoIssue[] } {
  const errors: DemoIssue[] = [];
  const warnings: DemoIssue[] = [];
  let total = 0;
  draft.steps.forEach((s, i) => {
    if (!s.say) return;
    const at = `steps[${i}].say`;
    const text = s.say.text;
    total += text.length;
    const outside = text.replace(/`[^`]*`/g, "");
    for (const [re, what] of MARKUP) {
      if (re.test(outside)) errors.push({ code: "E_SAY_MARKUP", step_id: s.id, path: `${at}.text`, message: `say.text に ${what} があります`, hint: "字幕で使える書式はインラインの `code` だけです" });
    }
    if ((text.match(/`/g) ?? []).length % 2 === 1) errors.push({ code: "E_SAY_MARKUP", step_id: s.id, path: `${at}.text`, message: "バッククォートが閉じていません" });
    for (const sent of splitSentences(text)) {
      const len = sent.replace(/`/g, "").length;
      if (len > 60) errors.push({ code: "E_SENTENCE_LONG", step_id: s.id, path: `${at}.text`, message: `1 文が ${len} 字あります（字幕は 1 文 60 字以内、FR-D-35）: 「${sent.slice(0, 30)}…」`, hint: "句点で 2 文に分けてください" });
    }
    const reading = buildReading(text, s.say.reading, draft.glossary);
    for (const sent of splitSentences(reading)) {
      const ms = estimateSayMs(sent);
      if (ms > 8000) warnings.push({ code: "W_SENTENCE_SLOW", step_id: s.id, path: `${at}.reading`, message: `読み上げが 1 文 ${(ms / 1000).toFixed(1)} 秒の見込みです（目安 8 秒以内）: 「${sent.slice(0, 24)}…」` });
    }
    if (!s.say.reading && needsReading(text)) {
      const rest = unreadableParts(reading);
      if (rest.length) {
        warnings.push({
          code: "W_READING_MISSING",
          step_id: s.id,
          path: `${at}.reading`,
          message: `英字・記号（${rest.slice(0, 6).join(", ")}）に読みがありません。自動の読み「${reading.slice(0, 80)}」を使います`,
          hint: "say.reading にカナで読みを書くか、glossary に {term, reading} を足してください",
        });
      }
    } else if (s.say.reading) {
      const rest = unreadableParts(s.say.reading);
      if (rest.length) warnings.push({ code: "W_READING_MISSING", step_id: s.id, path: `${at}.reading`, message: `reading に英字・記号（${rest.slice(0, 6).join(", ")}）が残っています`, hint: "reading はカナ（とかな・漢字）で書いてください" });
    }
  });
  if (total > LIMITS.sayTotal) errors.push({ code: "E_SAY_TOO_LONG", path: "steps", message: `ナレーションが合計 ${total} 字あります（上限 ${LIMITS.sayTotal} 字）`, hint: "説明を絞るか、ステップをまとめてください" });
  return { errors, warnings };
}

function fmtS(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`;
}
function fmtMin(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** time_management の「N 分以内に方針」「N 分以内にサンプル AC」を拾う */
function milestones(text: string | undefined): { planMin?: number; sampleAcMin?: number } {
  if (!text) return {};
  const plan = /(\d+)\s*分以内に[^、。]*方針/.exec(text);
  const ac = /(\d+)\s*分以内に[^、。]*(?:サンプル|AC|動く)/.exec(text);
  return { planMin: plan ? Number(plan[1]) : undefined, sampleAcMin: ac ? Number(ac[1]) : undefined };
}

/** P5: タイミング（D4/D5/D6、FR-D-33/34） */
export function checkTiming(draft: DemoDraft, compiled: CompiledDemo, timings: StepTimingReport[], ctx: CheckContext): { errors: DemoIssue[]; warnings: DemoIssue[] } {
  const errors: DemoIssue[] = [];
  const warnings: DemoIssue[] = [];
  const pathOf = (id: string) => `steps[${draft.steps.findIndex((s) => s.id === id)}]`;
  for (const tm of timings) {
    if (tm.silent_typing_ms > TIMING.silentErrorMs) {
      errors.push({
        code: "E_SILENT_TYPING",
        step_id: tm.id,
        path: pathOf(tm.id),
        message: `説明 ${fmtS(tm.say_ms)} に対して打鍵 ${fmtS(tm.typing_ms)}（${tm.typed_chars} 字）。説明が終わった後の無発話の打鍵が ${fmtS(tm.silent_typing_ms)}（上限 ${TIMING.silentErrorMs / 1000} 秒、D5）`,
        hint: "say を足して書いている内容を説明するか、ステップを 2 つに分けてください。定型部分は pace: \"fast\" にもできます",
      });
    } else if (tm.silent_typing_ms > TIMING.silentWarnMs) {
      warnings.push({ code: "W_SILENT_TYPING", step_id: tm.id, path: pathOf(tm.id), message: `無発話の打鍵が ${fmtS(tm.silent_typing_ms)} あります（3 秒以内が目安）` });
    }
    if (tm.t1 - tm.t0 > 60_000) warnings.push({ code: "W_LONG_SEGMENT", step_id: tm.id, path: pathOf(tm.id), message: `1 ステップが ${fmtS(tm.t1 - tm.t0)} あります（60 秒以内が目安）` });
  }
  const limitMs = ctx.meta.time_limit * 60_000;
  const hardMs = Math.min(limitMs, 20 * 60_000);
  const D = compiled.duration;
  if (D > hardMs) errors.push({ code: "E_TOO_LONG", message: `推定の長さ ${fmtMin(D)} が上限 ${fmtMin(hardMs)}（制限時間 ${ctx.meta.time_limit} 分、かつ 20 分以内）を超えています（D6）`, hint: "説明を短くするか、ステップを減らしてください。目標は制限時間の 50〜70% です" });
  else if (D > limitMs * 0.7) warnings.push({ code: "W_LONG", message: `推定の長さ ${fmtMin(D)} が制限時間の 70%（${fmtMin(limitMs * 0.7)}）を超えています（目標 50〜70%）` });
  // target_minutes を書いた台本は、その目標からのずれ（W_TARGET）で見る（短い問題で意図して短くした場合に警告を重ねない）
  else if (D < limitMs * 0.5 && !draft.target_minutes) warnings.push({ code: "W_TOO_SHORT", message: `推定の長さ ${fmtMin(D)} が制限時間の 50%（${fmtMin(limitMs * 0.5)}）未満です（目標 50〜70%）。説明が足りていない章が無いか確認してください` });
  if (draft.target_minutes) {
    const target = draft.target_minutes * 60_000;
    if (Math.abs(D - target) > target * 0.3) warnings.push({ code: "W_TARGET", message: `推定の長さ ${fmtMin(D)} が target_minutes（${draft.target_minutes} 分）から 30% 以上ずれています` });
  }
  // rubric_hints.time_management の節目
  const ms = milestones(ctx.meta.rubric_hints.time_management);
  const planCh = compiled.chapters.find((c) => c.phase === "plan");
  if (ms.planMin && planCh && planCh.t0 > ms.planMin * 60_000) warnings.push({ code: "W_MILESTONE", message: `方針宣言の章が ${fmtMin(planCh.t0)} からです（${ms.planMin} 分以内が目安: ${ctx.meta.rubric_hints.time_management}）` });
  if (ms.sampleAcMin) {
    const firstAc = compiled.steps.find((s) => s.run && (s.run.result.verdict === "AC" || s.run.result.verdict === "PASS"));
    if (firstAc?.run && firstAc.run.shown_until > ms.sampleAcMin * 60_000) warnings.push({ code: "W_MILESTONE", step_id: firstAc.id, message: `最初に通る実行が ${fmtMin(firstAc.run.shown_until)} です（${ms.sampleAcMin} 分以内が目安）` });
  }
  return { errors, warnings };
}

/** P7: 網羅（FR-D-32）。detectTalkingPoints（metrics.ts）でナレーションから拾えるかも見る */
export function checkCoverage(draft: DemoDraft, segments: TranscriptSegment[], ctx: CheckContext): {
  errors: DemoIssue[];
  warnings: DemoIssue[];
  coverage: { talking_points: Record<string, string[]>; requirements: Record<string, string[]>; red_flags: Record<string, string[]> };
} {
  const errors: DemoIssue[] = [];
  const warnings: DemoIssue[] = [];
  const ids = coverIds(ctx.meta);
  const by = (list: string[]) => Object.fromEntries(list.map((id) => [id, draft.steps.filter((s) => s.covers.includes(id)).map((s) => s.id)]));
  const coverage = { talking_points: by(ids.tp), requirements: by(ids.req), red_flags: by(ids.rf) };
  const hits = new Map(detectTalkingPoints(ctx.meta, segments).map((h) => [h.id, h]));
  for (const tp of ctx.meta.talking_points) {
    const steps = coverage.talking_points[tp.id] ?? [];
    if (!steps.length) {
      errors.push({ code: "E_COVERAGE", message: `talking_point ${tp.id}「${tp.text}」に触れる step がありません（FR-D-32）`, hint: `触れている step の covers に "${tp.id}" を書いてください（無ければ説明を足す）` });
    } else if ((hits.get(tp.id)?.t ?? null) === null) {
      warnings.push({ code: "W_COVER_NOT_SPOKEN", step_id: steps[0], message: `${tp.id} は covers にありますが、ナレーションから機械的に検出できません（キーワード: ${tp.text}）`, hint: "talking_point の語（英字の専門語、または日本語の語 2 つ以上）をナレーションに入れると、利用者の指標と同じ物差しで ✓ が付きます" });
    }
  }
  for (const r of ctx.meta.requirements) {
    if (!(coverage.requirements[r.id] ?? []).length) warnings.push({ code: "W_COVERAGE", message: `requirement ${r.id}「${r.label}」に触れる step がありません`, hint: `説明している step の covers に "${r.id}" を書いてください` });
  }
  return { errors, warnings, coverage };
}

/** ナレーションで `識別子` と言ったのに、30 秒以内にコードへ現れない（02 P8 W_SYMBOL_NOT_IN_CODE） */
export function checkSymbols(draft: DemoDraft, compiled: CompiledDemo, stepTexts: Map<string, { before: string; after: string }>, ctx: CheckContext): DemoIssue[] {
  const out: DemoIssue[] = [];
  const statement = `${ctx.body?.statement ?? ""}\n${ctx.body?.constraints ?? ""}`;
  for (const cs of compiled.steps) {
    const st = draft.steps.find((s) => s.id === cs.id);
    if (!st?.say) continue;
    const idents = [...st.say.text.matchAll(/`([A-Za-z_][A-Za-z0-9_.]*)`/g)].map((m) => m[1]!).filter((x) => x.length > 1 && !statement.includes(x));
    if (!idents.length) continue;
    const window = compiled.steps.filter((o) => o.t0 >= cs.t0 && o.t0 <= cs.t0 + 30_000).map((o) => stepTexts.get(o.id)?.after ?? "");
    const here = stepTexts.get(cs.id)?.before ?? "";
    for (const id of new Set(idents)) {
      if (!here.includes(id) && !window.some((t) => t.includes(id))) out.push({ code: "W_SYMBOL_NOT_IN_CODE", step_id: cs.id, message: `ナレーションの \`${id}\` が 30 秒以内にコードへ現れません`, hint: "説明とコードの名前をそろえてください（説明と実装の同期、R7）" });
    }
  }
  return out;
}

export interface SelfMetrics {
  silent_typing_max_s: number;
  silent_edit_ratio: number;
  lead_time_median_s: number | null;
}

/** デモ自身を利用者と同じ物差し（core.computeMetrics）で測る（FR-D-45、02 P6） */
export function demoMetrics(compiled: CompiledDemo, meta: ProblemMeta, timings: StepTimingReport[]): { metrics: Metrics; self: SelfMetrics } {
  const metrics = computeMetrics({ events: compiled.events, segments: compiled.narration.segments, meta, ended_t: compiled.duration });
  const maxSilent = timings.reduce((a, t) => Math.max(a, t.silent_typing_ms), 0);
  return {
    metrics,
    self: {
      silent_typing_max_s: Math.round(maxSilent / 100) / 10,
      silent_edit_ratio: metrics.silent_edit_ratio,
      lead_time_median_s: metrics.lead_time_s.median,
    },
  };
}

/** P6: 自己採点。「模範が利用者の指標で模範でない」事故を防ぐ */
export function checkSelfMetrics(draft: DemoDraft, metrics: Metrics): { errors: DemoIssue[]; warnings: DemoIssue[] } {
  const errors: DemoIssue[] = [];
  const warnings: DemoIssue[] = [];
  const silentEditing = metrics.silence_gt15s.filter((s) => s.editing);
  if (silentEditing.length) {
    errors.push({
      code: "E_SELF_METRIC",
      message: `15 秒を超える沈黙の中で編集している区間があります（${silentEditing.map((s) => `${Math.round(s.t0 / 1000)}s〜${Math.round(s.t1 / 1000)}s`).join(", ")}）。利用者の指標では「黙って書く」と判定されます`,
      hint: "その区間のステップに say を足してください",
    });
  }
  if (metrics.silent_edit_ratio > 0.2) {
    errors.push({ code: "E_SELF_METRIC", message: `無発話の編集の比率が ${metrics.silent_edit_ratio} です（上限 0.2）`, hint: "コードを打つステップには、打っている内容の説明（say）を付けてください" });
  }
  const reqChapters = new Set(draft.chapters.filter((c) => c.phase === "requirements").map((c) => c.id));
  const early = draft.steps.find((s) => reqChapters.has(s.chapter) && s.code.length > 0);
  if (early) warnings.push({ code: "W_CODE_BEFORE_PLAN", step_id: early.id, message: "要件確認の章でコードを編集しています", hint: "コードは方針宣言（plan）以降で書いてください（方針のコメントは plan の章で）" });
  if (!metrics.run_events.length) warnings.push({ code: "W_NO_TEST_RUN", message: "実行（run）が 1 回もありません" });
  return { errors, warnings };
}
