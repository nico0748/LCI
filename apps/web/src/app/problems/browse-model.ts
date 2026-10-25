/**
 * 閲覧画面（ホーム・問題一覧・問題詳細・履歴）で共有する純粋な集計と絞り込み。
 * サーバでもクライアントでも動くよう、Node の API と "@/..." の別名は使わない（node --test から直接読む）。
 */
import { AXES, CATEGORY_LABEL, type Axis, type Category, type Language, type ProblemSummary, type SessionStatus } from "@lci/core/browser";

/** 最新の総合がこれ未満なら「要再挑戦」。一覧のフィルタ説明にもこの値を出す */
export const RETRY_THRESHOLD = 3.5;

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as Category[];
export const DIFFICULTIES = ["L1", "L2", "L3", "L4"] as const;
export const TIME_LIMITS = [15, 20, 30, 45] as const;

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  preparing: "準備中",
  recording: "記録が途中",
  finalizing: "処理中",
  ready: "完了",
  failed: "失敗",
  recovering: "復旧中",
};

/** 状態の色（X2 のシステム状態）。StatusBadge の tone にそのまま渡す */
export const SESSION_STATUS_TONE: Record<SessionStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  preparing: "neutral",
  recording: "warning",
  finalizing: "info",
  ready: "success",
  failed: "danger",
  recovering: "warning",
};

/** company_style の表示名（「pixiv 形式」のように使う） */
const STYLE_LABEL: Record<string, string> = { pixiv: "pixiv", m3: "M3", leetcode: "LeetCode", atcoder: "AtCoder" };
export function styleLabel(style: string): string | null {
  if (style === "generic") return null;
  return STYLE_LABEL[style] ?? style;
}

/** 判定方式（tests.kind）を人の言葉に */
export const JUDGE_LABEL: Record<ProblemSummary["kind"], string> = {
  web: "ブラウザで動作確認",
  stdio: "入出力のテストで判定",
  unit: "ユニットテストで判定",
  none: "自動判定なし（説明が中心）",
};

export const AXIS_LABEL = Object.fromEntries(AXES.map((a) => [a.id, a.label])) as Record<Axis, string>;

// ---- セッションの軽量表現 ---------------------------------------------------

export interface EvalLite {
  created_at: string;
  overall: number;
  scores: Record<Axis, number>;
  next_practice: { axis: Axis; action: string }[];
  summary: string;
}

export interface SessionLite {
  session_id: string;
  status: SessionStatus;
  started_at_wall: string;
  problem: { id: string; title: string; language: Language };
  /** 終了済みなら長さ（ms）。分からなければ null */
  durationMs: number | null;
  /** created_at 昇順 */
  evaluations: EvalLite[];
  /** 無言で編集していた割合（metrics.json があれば） */
  silentEditRatio: number | null;
}

/** 記録が終わっていない（または失敗した）セッション。履歴の表から分けて、操作を付けて上に出す */
export function isUnfinished(s: Pick<SessionLite, "status">): boolean {
  return s.status !== "ready";
}

/** ISO 時刻をミリ秒に（タイムゾーン表記が混在するので文字列のまま比べない）。読めなければ 0 */
export function wallTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function latestEval(s: SessionLite): EvalLite | null {
  return s.evaluations[s.evaluations.length - 1] ?? null;
}

/** 全セッションのうち最も新しい評価と、そのセッション */
export function latestEvaluated(sessions: SessionLite[]): { session: SessionLite; evaluation: EvalLite } | null {
  let best: { session: SessionLite; evaluation: EvalLite } | null = null;
  for (const s of sessions) {
    const e = latestEval(s);
    if (e && (!best || wallTime(e.created_at) > wallTime(best.evaluation.created_at))) best = { session: s, evaluation: e };
  }
  return best;
}

// ---- 問題ごとの記録 -----------------------------------------------------------

export type ProblemState = "untried" | "tried" | "retry";

export const PROBLEM_STATE_LABEL: Record<ProblemState, string> = { untried: "未着手", tried: "挑戦済み", retry: "要再挑戦" };

export interface ProblemRecord {
  problemId: string;
  /** 完了したセッションの数 */
  attempts: number;
  lastAt: string;
  lastSessionId: string;
  /** 最新の評価の総合（評価が無ければ null） */
  lastOverall: number | null;
  /** その 1 つ前の評価の総合 */
  prevOverall: number | null;
  bestOverall: number | null;
  /** 最新の評価が付いたセッション */
  lastEvaluatedSessionId: string | null;
  lastEvaluatedAt: string | null;
  nextPractice: { axis: Axis; action: string }[];
  state: ProblemState;
}

/** 完了したセッションから問題ごとの記録を作る。未完了のセッションは数えない */
export function buildRecords(sessions: SessionLite[]): Map<string, ProblemRecord> {
  const done = sessions.filter((s) => !isUnfinished(s)).sort((a, b) => wallTime(a.started_at_wall) - wallTime(b.started_at_wall));
  const out = new Map<string, ProblemRecord>();
  for (const s of done) {
    const r: ProblemRecord = out.get(s.problem.id) ?? {
      problemId: s.problem.id,
      attempts: 0,
      lastAt: s.started_at_wall,
      lastSessionId: s.session_id,
      lastOverall: null,
      prevOverall: null,
      bestOverall: null,
      lastEvaluatedSessionId: null,
      lastEvaluatedAt: null,
      nextPractice: [],
      state: "tried",
    };
    r.attempts += 1;
    r.lastAt = s.started_at_wall;
    r.lastSessionId = s.session_id;
    const e = latestEval(s);
    if (e) {
      r.prevOverall = r.lastOverall;
      r.lastOverall = e.overall;
      r.bestOverall = r.bestOverall == null ? e.overall : Math.max(r.bestOverall, e.overall);
      r.lastEvaluatedSessionId = s.session_id;
      r.lastEvaluatedAt = e.created_at;
      r.nextPractice = e.next_practice;
    }
    out.set(s.problem.id, r);
  }
  for (const r of out.values()) r.state = r.lastOverall != null && r.lastOverall < RETRY_THRESHOLD ? "retry" : "tried";
  return out;
}

export function problemState(rec: ProblemRecord | undefined): ProblemState {
  return rec?.state ?? "untried";
}

// ---- 並び・推薦 ---------------------------------------------------------------

export function compareProblems(a: ProblemSummary, b: ProblemSummary): number {
  return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.difficulty.localeCompare(b.difficulty) || a.id.localeCompare(b.id);
}

export type RecommendKind = "first" | "retry" | "same-category" | "same-style" | "new-category" | "untried";

export interface Recommendation {
  problem: ProblemSummary;
  kind: RecommendKind;
  /** 推薦理由（チップに出す。必ず表示する） */
  reason: string;
}

/** 最初の 1 問。fe-0001（pixiv 形式・L2・20 分）を基準にし、無ければ一番やさしい core */
export const FIRST_PROBLEM_ID = "fe-0001";

/**
 * 次の 1 問の候補（最大 max 件）。決定的なルールで選び、理由を必ず付ける（02 §2.1）。
 * 1. 最新の評価が RETRY_THRESHOLD 未満なら、その問題を再挑戦
 * 2. 直近に練習した問題と同じカテゴリの未着手
 * 3. 直近に練習した問題と同じ面接形式（company_style）の未着手
 * 4. まだ 1 回も練習していないカテゴリの、いちばんやさしい未着手
 * 5. 残りは未着手を一覧の順に
 * 弱点の軸と問題を結ぶデータは無いので、「この問題で○○が鍛えられる」とは言わない。
 */
export function recommend(problems: ProblemSummary[], records: Map<string, ProblemRecord>, sessions: SessionLite[], max = 3): Recommendation[] {
  const pool = problems.filter((p) => p.tier !== "draft").sort(compareProblems);
  const byId = new Map(pool.map((p) => [p.id, p]));
  const done = sessions.filter((s) => !isUnfinished(s)).sort((a, b) => wallTime(b.started_at_wall) - wallTime(a.started_at_wall));
  if (done.length === 0) {
    const first = byId.get(FIRST_PROBLEM_ID) ?? [...pool].sort((a, b) => a.difficulty.localeCompare(b.difficulty))[0];
    return first ? [{ problem: first, kind: "first", reason: "はじめの 1 問" }] : [];
  }
  const out: Recommendation[] = [];
  const used = new Set<string>();
  const push = (p: ProblemSummary | undefined, kind: RecommendKind, reason: string) => {
    if (!p || used.has(p.id) || out.length >= max) return;
    used.add(p.id);
    out.push({ problem: p, kind, reason });
  };
  const untried = (p: ProblemSummary) => !records.has(p.id) && !used.has(p.id);
  const easiest = (ps: ProblemSummary[]) => [...ps].sort((a, b) => a.difficulty.localeCompare(b.difficulty) || compareProblems(a, b))[0];

  const latest = latestEvaluated(done);
  if (latest && latest.evaluation.overall < RETRY_THRESHOLD) {
    push(byId.get(latest.session.problem.id), "retry", `再挑戦 · 前回 ${latest.evaluation.overall.toFixed(1)}`);
  }
  const recent = byId.get(done[0]!.problem.id);
  if (recent) {
    push(easiest(pool.filter((p) => p.category === recent.category && untried(p))), "same-category", `${recent.category} の未着手`);
    const style = recent.tags.company_style.find((s) => styleLabel(s) != null);
    if (style) {
      // 同じ形式のうち、できれば別カテゴリを選ぶ（2 枚目と同じカテゴリが並ばないように）
      const sameStyle = pool.filter((p) => p.tags.company_style.includes(style) && untried(p));
      push(easiest(sameStyle.filter((p) => p.category !== recent.category)) ?? easiest(sameStyle), "same-style", `${styleLabel(style)} 形式`);
    }
  }
  const triedCats = new Set([...records.keys()].map((id) => byId.get(id)?.category));
  push(easiest(pool.filter((p) => !triedCats.has(p.category) && untried(p))), "new-category", "新しいカテゴリ");
  for (const p of pool) if (untried(p)) push(p, "untried", "未着手");
  return out;
}

// ---- 一覧の絞り込み -----------------------------------------------------------

export interface BrowserFilters {
  q: string;
  category: string[];
  difficulty: string[];
  time_limit: string[];
  status: string[];
  language: string;
  nfr: string;
  /** 下書き（tier: draft）も表示する */
  drafts: boolean;
}

export const EMPTY_FILTERS: BrowserFilters = { q: "", category: [], difficulty: [], time_limit: [], status: [], language: "", nfr: "", drafts: false };

/** 複数選択の絞り込みキー（チェックボックス群） */
export type MultiKey = "category" | "difficulty" | "time_limit" | "status";

/** URL の検索パラメータから（複数値はカンマ区切り。旧形式の単一値もそのまま読める） */
export function parseFilters(get: (k: string) => string): BrowserFilters {
  const list = (k: string) =>
    get(k)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    q: get("q"),
    category: list("category"),
    difficulty: list("difficulty"),
    time_limit: list("time_limit"),
    status: list("status"),
    language: get("language"),
    nfr: get("nfr"),
    drafts: get("drafts") === "1",
  };
}

/** URL に書く値（空は消す） */
export function filtersToEntries(f: BrowserFilters): [string, string][] {
  const e: [string, string][] = [];
  if (f.q) e.push(["q", f.q]);
  for (const k of ["category", "difficulty", "time_limit", "status"] as const) if (f[k].length) e.push([k, f[k].join(",")]);
  if (f.language) e.push(["language", f.language]);
  if (f.nfr) e.push(["nfr", f.nfr]);
  if (f.drafts) e.push(["drafts", "1"]);
  return e;
}

export function hasActiveFilters(f: BrowserFilters): boolean {
  return filtersToEntries(f).length > 0;
}

/**
 * 絞り込み。skip を渡すとその条件だけ無視する（チェックボックスの横の件数を「ほかの条件を当てたときの数」にするため）。
 */
export function filterProblems(problems: ProblemSummary[], records: Map<string, ProblemRecord>, f: BrowserFilters, skip?: MultiKey): ProblemSummary[] {
  const q = f.q.trim().toLowerCase();
  const inList = (k: MultiKey, v: string) => skip === k || f[k].length === 0 || f[k].includes(v);
  return problems
    .filter((p) => f.drafts || p.tier !== "draft")
    .filter((p) => inList("category", p.category))
    .filter((p) => inList("difficulty", p.difficulty))
    .filter((p) => inList("time_limit", String(p.time_limit)))
    .filter((p) => inList("status", problemState(records.get(p.id))))
    .filter((p) => !f.language || p.languages.includes(f.language as Language))
    .filter((p) => !f.nfr || p.tags.nfr.includes(f.nfr))
    .filter((p) => {
      if (!q) return true;
      const hay = [p.id, p.slug, p.title, ...p.tags.nfr, ...p.tags.company_style, ...p.tags.talk_focus, ...p.tags.security].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort(compareProblems);
}

// ---- 表示用の小物 -------------------------------------------------------------

/** 前回比（+0.4 / −0.2 / ±0）。どちらかが無ければ null */
export function formatDelta(now: number | null, prev: number | null): string | null {
  if (now == null || prev == null) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return "±0";
  return d > 0 ? `+${d.toFixed(1)}` : `−${Math.abs(d).toFixed(1)}`;
}

/** 合計時間（分、切り上げない） */
export function totalMinutes(sessions: SessionLite[]): number {
  return Math.round(sessions.reduce((acc, s) => acc + (s.durationMs ?? 0), 0) / 60000);
}

/** 履歴の要約の 3 つの数（02 §2.4: 練習回数・合計時間・評価済み回数） */
export function practiceSummary(sessions: SessionLite[]): { count: number; minutes: number; evaluated: number } {
  const done = sessions.filter((s) => !isUnfinished(s));
  return { count: done.length, minutes: totalMinutes(done), evaluated: done.filter((s) => s.evaluations.length > 0).length };
}

/** 「10/24 1:15」。年が今年と違うときだけ年を付ける */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${sameYear ? "" : `${d.getFullYear()}/`}${md} ${hm}`;
}

/** 「10/24」 */
export function formatDay(iso: string, now: Date = new Date()): string {
  return formatWhen(iso, now).split(" ")[0]!;
}

/** 問題 ID ごとに、カテゴリの練習の進み具合（挑戦済み / 問題数） */
export function categoryProgress(problems: ProblemSummary[], records: Map<string, ProblemRecord>): { category: Category; total: number; tried: number }[] {
  return CATEGORY_ORDER.map((category) => {
    const ps = problems.filter((p) => p.category === category && p.tier !== "draft");
    return { category, total: ps.length, tried: ps.filter((p) => records.has(p.id)).length };
  });
}
