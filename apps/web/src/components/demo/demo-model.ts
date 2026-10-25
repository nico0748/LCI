/**
 * 模範解答デモの再生で使う純粋な計算（docs/requirements/demo/01_ux.md §3・§6）。
 * node --test から直接読むので、"@/..." の別名と React は使わない。
 *
 * 同期の単位は「文」。字幕・音声の頭出し・シークの丸めはすべて文の区切りを使う。
 * バックエンドの narration は step ごとの区間（複数文を含んでよい）なので、句点で分けて
 * 文字数の比で時刻を割り振る（00_decisions.md D1）。
 */
import { AXES, fmtT, type Axis, type Language, type Metrics, type Transcript, type TranscriptSegment } from "@lci/core/browser";
import type { CompiledDemo, CompiledStep, DemoSummary, RunSnapshot } from "@lci/demo/browser";

// ---- 文（字幕の単位）----------------------------------------------------------

export interface Cue {
  /** 0 始まりの通し番号 */
  idx: number;
  stepId: string;
  chapterId: string;
  t0: number;
  t1: number;
  /** 字幕（インライン `code` を含んでよい） */
  text: string;
}

/**
 * 字幕を文に分ける。句点（。！？）の直後で切り、インラインコード（`...`）と括弧の中では切らない。
 * 句点の後ろに続く閉じ括弧・空白は前の文に含める。
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inCode = false;
  // 括弧（「」『』（））の中の句点では切らない
  let depth = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    cur += c;
    if (c === "`") inCode = !inCode;
    if (!inCode && (c === "「" || c === "『" || c === "（")) depth++;
    if (!inCode && (c === "」" || c === "』" || c === "）")) depth = Math.max(0, depth - 1);
    if (!inCode && depth === 0 && (c === "。" || c === "！" || c === "？")) {
      while (i + 1 < chars.length && /[」』）)\s]/.test(chars[i + 1]!)) cur += chars[++i]!;
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 字幕の文字数（時刻の割り振りに使う重み。バッククォートは数えない） */
function weightOf(s: string): number {
  return Math.max(1, [...s.replace(/`/g, "")].length);
}

/** step の区間（ms）。say が無い step は区間全体 */
function stepOfSegment(steps: CompiledStep[], seg: TranscriptSegment): CompiledStep | undefined {
  return steps.find((s) => s.say && Math.abs(s.say.t0 - seg.t_start) < 1) ?? steps.find((s) => seg.t_start >= s.t0 && seg.t_start < s.t1);
}

/** narration（step ごと or 文ごと）を文の並びにする。区間内の時刻は文字数の比で割り振る */
export function buildCues(demo: Pick<CompiledDemo, "narration" | "steps">): Cue[] {
  const cues: Cue[] = [];
  const segs = [...demo.narration.segments].filter((s) => s.text.trim()).sort((a, b) => a.t_start - b.t_start);
  for (const seg of segs) {
    const step = stepOfSegment(demo.steps, seg);
    const parts = splitSentences(seg.text);
    const total = parts.reduce((a, p) => a + weightOf(p), 0);
    const span = Math.max(0, seg.t_end - seg.t_start);
    let acc = 0;
    parts.forEach((p, i) => {
      const t0 = seg.t_start + Math.round((span * acc) / total);
      acc += weightOf(p);
      const t1 = i === parts.length - 1 ? seg.t_end : seg.t_start + Math.round((span * acc) / total);
      cues.push({ idx: cues.length, stepId: step?.id ?? "", chapterId: step?.chapter ?? "", t0, t1, text: p });
    });
  }
  return cues;
}

/** 字幕の一覧（TranscriptPane に渡す形）。1 文 = 1 セグメント */
export function cuesToTranscript(cues: Cue[]): Transcript {
  return {
    schema_version: "1.0",
    recorder: "demo",
    engine: "demo",
    segments: cues.map((c) => ({ id: c.idx, start_ms: c.t0, end_ms: c.t1, t_start: c.t0, t_end: c.t1, text: c.text, is_filler: false, words: [] })),
  };
}

/** t を含む文（文と文の間なら直前の文を返さず -1） */
export function cueIndexAt(cues: Cue[], t: number): number {
  for (let i = cues.length - 1; i >= 0; i--) if (cues[i]!.t0 <= t) return t < cues[i]!.t1 ? i : -1;
  return -1;
}

/** 字幕バーに出す文: 話している文。文と文の間（打鍵・実行の間）は直前の文を残す */
export function captionIndexAt(cues: Cue[], t: number): number {
  for (let i = cues.length - 1; i >= 0; i--) if (cues[i]!.t0 <= t) return i;
  return -1;
}

// ---- シークの区切りと移動 ----------------------------------------------------------

/** シークの丸め先: 文・編集グループ・実行の開始と章の開始（01 §3「シーク」） */
export function seekPoints(demo: Pick<CompiledDemo, "steps" | "chapters">, cues: Cue[]): number[] {
  const set = new Set<number>([0]);
  for (const c of cues) set.add(c.t0);
  for (const s of demo.steps) {
    if (s.typing) set.add(s.typing.t0);
    if (s.run) set.add(s.run.t);
  }
  for (const ch of demo.chapters) set.add(ch.t0);
  return [...set].sort((a, b) => a - b);
}

/** t 以前で最も近い区切り。区切りの直後 1ms 以内は同じ区切りとみなす */
export function roundSeek(t: number, points: number[]): number {
  let ans = 0;
  for (const p of points) {
    if (p <= t + 1) ans = p;
    else break;
  }
  return ans;
}

/** ← : 文の頭から threshold 以上たっていれば今の文の頭、そうでなければ前の文の頭 */
export function prevCueStart(cues: Cue[], t: number, threshold = 1500): number {
  const i = captionIndexAt(cues, t);
  if (i < 0) return 0;
  if (t - cues[i]!.t0 >= threshold) return cues[i]!.t0;
  return i > 0 ? cues[i - 1]!.t0 : 0;
}

/** → : 次の文の頭（無ければ null） */
export function nextCueStart(cues: Cue[], t: number): number | null {
  const c = cues.find((x) => x.t0 > t + 1);
  return c ? c.t0 : null;
}

export interface ChapterLike {
  id: string;
  t0: number;
  t1: number;
}

export function chapterIndexAt(chapters: ChapterLike[], t: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) if (chapters[i]!.t0 <= t + 1) return i;
  return chapters.length ? 0 : -1;
}

/** k : 章の頭から threshold 以上たっていれば今の章の頭、そうでなければ前の章の頭 */
export function prevChapterStart(chapters: ChapterLike[], t: number, threshold = 1500): number {
  const i = chapterIndexAt(chapters, t);
  if (i < 0) return 0;
  if (t - chapters[i]!.t0 >= threshold) return chapters[i]!.t0;
  return i > 0 ? chapters[i - 1]!.t0 : chapters[0]!.t0;
}

/** j : 次の章の頭（無ければ null） */
export function nextChapterStart(chapters: ChapterLike[], t: number): number | null {
  const c = chapters.find((x) => x.t0 > t + 1);
  return c ? c.t0 : null;
}

// ---- 速度 -------------------------------------------------------------------------

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/** 速度を 1 段上げる / 下げる（端では止まる） */
export function stepSpeed(cur: number, dir: 1 | -1): Speed {
  const i = SPEEDS.findIndex((s) => s === cur);
  const base = i < 0 ? 1 : i;
  return SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, base + dir))]!;
}

export function speedLabel(s: number): string {
  return `${s}x`;
}

// ---- step・実行・話すべきポイント ------------------------------------------------------

export function stepIndexAt(steps: CompiledStep[], t: number): number {
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i]!.t0 <= t) return i;
  return steps.length ? 0 : -1;
}

export interface RunView {
  step: CompiledStep;
  /** running = 「実行中…」、done = 結果を表示 */
  phase: "running" | "done";
  result: RunSnapshot;
  mode: NonNullable<CompiledStep["run"]>["mode"];
}

/** t 時点で見せる実行（直近に始まった実行。shown_until までは「実行中…」） */
export function runAt(steps: CompiledStep[], t: number): RunView | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.run && s.run.t <= t) return { step: s, phase: t < s.run.shown_until ? "running" : "done", result: s.run.result, mode: s.run.mode };
  }
  return null;
}

/** 話すべきポイント・要件の id → 初めて触れた時刻（その step の発話の開始） */
export function coverageTimes(steps: CompiledStep[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of steps) {
    const at = s.say?.t0 ?? s.t0;
    for (const id of s.covers) if (!out.has(id) || out.get(id)! > at) out.set(id, at);
  }
  return out;
}

// ---- 実行結果の言葉 --------------------------------------------------------------------

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const VERDICT_LABEL: Record<RunSnapshot["verdict"], { tone: Tone; label: string }> = {
  AC: { tone: "success", label: "AC" },
  PASS: { tone: "success", label: "PASS" },
  WA: { tone: "danger", label: "WA 出力が不一致" },
  RE: { tone: "danger", label: "RE 実行時エラー" },
  CE: { tone: "danger", label: "CE コンパイルエラー" },
  IE: { tone: "danger", label: "IE 実行環境のエラー" },
  FAIL: { tone: "danger", label: "FAIL" },
  TLE: { tone: "warning", label: "TLE 時間超過" },
  MLE: { tone: "warning", label: "MLE メモリ超過" },
  OLE: { tone: "warning", label: "OLE 出力が多すぎます" },
};

export function verdictView(v: RunSnapshot["verdict"]): { tone: Tone; label: string } {
  return VERDICT_LABEL[v] ?? { tone: "neutral", label: v };
}

export const isPassing = (v: string | undefined): boolean => v === "AC" || v === "PASS";

export const RUN_MODE_LABEL: Record<RunView["mode"], string> = { sample: "サンプル", stdin: "自作の入力", judge: "全ケースで判定" };

/** ヘッダの検証状態（FR-D-40）。図形と文字を併記し、色はシステム状態（X2） */
export function trustState(s: Pick<DemoSummary, "final_verdict" | "passed" | "total">): { tone: "success" | "warning" | "danger"; label: string } {
  if (s.total <= 0 || s.final_verdict === "IE") return { tone: "warning", label: "未検証" };
  if (isPassing(s.final_verdict) && s.passed === s.total) return { tone: "success", label: `全テスト通過 ${s.passed}/${s.total}` };
  return { tone: "danger", label: `失敗 ${s.passed}/${s.total} 通過` };
}

export function isVerified(s: Pick<DemoSummary, "final_verdict" | "passed" | "total">): boolean {
  return trustState(s).tone === "success";
}

// ---- 言語と版 -------------------------------------------------------------------------

/** 00_overview.md D13 の順（TS/JS → Python → Go → PHP → Rust → C）。それ以外は後ろ */
export const LANGUAGE_PRIORITY: Language[] = ["typescript", "javascript", "python", "go", "php", "rust", "c"];

export function sortLanguages(langs: Language[]): Language[] {
  const rank = (l: Language) => {
    const i = LANGUAGE_PRIORITY.indexOf(l);
    return i < 0 ? LANGUAGE_PRIORITY.length : i;
  };
  return [...langs].sort((a, b) => rank(a) - rank(b));
}

/**
 * 既定の言語（FR-D-05）: 入口（URL の lang）→ その問題の最新セッションの言語 → D13 の順の先頭。
 * 問題が対応していない言語は飛ばす。最後の段だけは、デモがある言語（available）を先に探す
 * （どの言語でも始めていない人に、無い言語の空状態を最初に見せないため）。
 */
export function defaultLanguage(input: { requested?: string | null; latestSession?: Language | null; languages: Language[]; available?: Language[] }): Language {
  const ok = (l: string | null | undefined): l is Language => !!l && input.languages.includes(l as Language);
  if (ok(input.requested)) return input.requested;
  if (ok(input.latestSession)) return input.latestSession;
  const sorted = sortLanguages(input.languages);
  return sorted.find((l) => input.available?.includes(l)) ?? sorted[0] ?? input.languages[0]!;
}

/** 言語ごとの版（古い順に 版 1, 2, …）。表示は新しい順 */
export function versionsFor(list: DemoSummary[], lang: Language): (DemoSummary & { n: number })[] {
  const mine = list.filter((d) => d.language === lang).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.demo_id.localeCompare(b.demo_id));
  return mine.map((d, i) => ({ ...d, n: i + 1 })).reverse();
}

/** 既定で開く版（FR-D-01）: URL の指定 → 最新の検証済み → 最新 */
export function pickDemo(list: DemoSummary[], lang: Language, requested?: string | null): DemoSummary | null {
  const mine = versionsFor(list, lang);
  if (requested) {
    const hit = mine.find((d) => d.demo_id === requested);
    if (hit) return hit;
  }
  return mine.find((d) => isVerified(d)) ?? mine[0] ?? null;
}

// ---- 自分のセッションとの比較（FR-D-60・レビューのデモカード） --------------------------------

/** 自分のセッションの書き始め（指標の phase_estimate で、設計が終わって実装が始まった時刻） */
export function userWriteStart(m: Pick<Metrics, "phase_estimate">): number | null {
  const impl = m.phase_estimate.find((p) => p.phase === "implement");
  return impl ? impl.t0 : null;
}

/** デモの書き始め（実装の章の頭）と最初の実行 */
export function demoMilestones(d: Pick<CompiledDemo, "chapters" | "steps">): { writeStart: number | null; firstRun: number | null } {
  const impl = d.chapters.find((c) => c.phase === "implement");
  const run = d.steps.find((s) => s.run)?.run;
  return { writeStart: impl ? impl.t0 : null, firstRun: run ? run.t : null };
}

/** 視聴の記録（このブラウザに最初に見た時刻を残す。D14 の SHOULD「視聴済みの記録とレビューへの注記」） */
export const VIEWED_KEY = (problemId: string) => `lci:demo-viewed:${problemId}`;

/** 視聴より後に始めたセッションか（レビューに「デモ視聴後のセッション」と注記する） */
export function startedAfterViewing(viewedAt: string | null | undefined, startedAt: string | null | undefined): boolean {
  if (!viewedAt || !startedAt) return false;
  const v = Date.parse(viewedAt);
  const s = Date.parse(startedAt);
  return Number.isFinite(v) && Number.isFinite(s) && v < s;
}

// ---- 表示の小物 -----------------------------------------------------------------------

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 「8:40」形式（ヘッダの長さ表示） */
export function fmtLength(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export { fmtT };

/** 再生位置の表示「01:42.7」。0.1 秒単位で切り捨てる（四捨五入すると末尾で長さの表示を越える・60.0 秒が出る） */
export function fmtClock(ms: number): string {
  const d = Math.max(0, Math.floor(ms / 100));
  const m = Math.floor(d / 600);
  const s = Math.floor((d % 600) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d % 10}`;
}

export const AXIS_SHORT = Object.fromEntries(AXES.map((a) => [a.id, a.label])) as Record<Axis, string>;

export const PHASE_LABEL: Record<CompiledDemo["chapters"][number]["phase"], string> = {
  requirements: "要件確認",
  plan: "方針宣言",
  implement: "実装",
  test: "検証",
  detour: "寄り道",
  review: "見直し",
};

/** 章の帯に収まらないときの短い名前（モバイルの帯「要件|方針|実装…」） */
export const PHASE_SHORT: Record<CompiledDemo["chapters"][number]["phase"], string> = {
  requirements: "要件",
  plan: "方針",
  implement: "実装",
  test: "検証",
  detour: "寄",
  review: "見直",
};

/** MCP で作成を頼む文（FR-D-50）。そのまま Claude に貼れるように、問題 ID と言語を入れる */
export function mcpRequestText(p: { id: string; title: string }, langLabel: string): string {
  return [
    `LCI の MCP サーバを使って、問題 ${p.id}（${p.title}）の ${langLabel} の模範解答デモを作ってください。`,
    `get_problem_for_demo で問題を読み、オーサリングガイド（author_demo）に従って台本を書き、validate_demo_script で検証してから save_demo_script で保存してください。`,
  ].join("\n");
}

/** 字幕のインラインコード（`...`）を分ける。HTML は解釈しない */
export function splitInlineCode(text: string): { code: boolean; text: string }[] {
  const out: { code: boolean; text: string }[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ code: false, text: text.slice(last, m.index) });
    out.push({ code: true, text: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) });
  return out;
}

// ---- キーボード（01 §6）----------------------------------------------------------------

export type DemoKeyAction =
  | "toggle"
  | "prevSentence"
  | "nextSentence"
  | "prevChapter"
  | "nextChapter"
  | "start"
  | "end"
  | "faster"
  | "slower"
  | "mute"
  | "help";

export interface DemoKeyTarget {
  tag: string;
  role: string | null;
  editable: boolean;
  inEditor: boolean;
  /** 矢印キーを自前で扱う要素の中（toolbar / tablist / slider / radiogroup） */
  inArrowWidget: boolean;
}

const ACTIVATABLE_TAGS = new Set(["BUTTON", "A", "SUMMARY", "INPUT", "SELECT", "TEXTAREA", "AUDIO", "VIDEO"]);
const ACTIVATABLE_ROLES = new Set(["button", "link", "tab", "slider", "switch", "checkbox", "radio", "menuitem", "option"]);

/**
 * グローバルのショートカット。レビュー画面のガード（timeline-layout.ts shortcutAllowed）と同じ考え方で、
 * 入力欄・エディタ内では止め、Space はボタン等の上では奪わず、矢印・Home/End は自前で扱う部品の中では止める。
 */
export function demoKeyAction(key: string, target: DemoKeyTarget, modified: boolean): DemoKeyAction | null {
  if (modified) return null;
  if (target.editable || target.inEditor) return null;
  const tag = target.tag.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
  switch (key) {
    case " ":
      return !ACTIVATABLE_TAGS.has(tag) && !(target.role && ACTIVATABLE_ROLES.has(target.role)) ? "toggle" : null;
    case "ArrowLeft":
      return target.inArrowWidget ? null : "prevSentence";
    case "ArrowRight":
      return target.inArrowWidget ? null : "nextSentence";
    case "Home":
      return target.inArrowWidget ? null : "start";
    case "End":
      return target.inArrowWidget ? null : "end";
    case "j":
      return "nextChapter";
    case "k":
      return "prevChapter";
    case ">":
      return "faster";
    case "<":
      return "slower";
    case "m":
      return "mute";
    case "?":
      return "help";
    default:
      return null;
  }
}

/** タイムライン（slider）の上のキー: ←/→/↑/↓ を「文」、PageUp/PageDown を「章」に読み替える（01 §6） */
export function sliderKeyAction(key: string): DemoKeyAction | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return "prevSentence";
    case "ArrowRight":
    case "ArrowUp":
      return "nextSentence";
    case "PageUp":
      return "nextChapter";
    case "PageDown":
      return "prevChapter";
    default:
      return null;
  }
}
