"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { fmtT } from "@lci/core/browser";
import type { DemoDetail } from "@lci/demo/browser";
import { Button, Dialog, IconButton, Kbd, LinkButton, Radio, Select, StatusBadge, cx, tabClass, tabListClass, useTabs } from "@/components/ui";
import { Markdown } from "@/components/review/markdown";
import { CodeTimeline } from "@/components/review/CodeTimeline";
import { TranscriptPane } from "@/components/review/TranscriptPane";
import { eventPins } from "@/components/review/pins";
import { needsReveal } from "@/components/review/timeline-layout";
import { WIDE_QUERY, useMediaQuery } from "@/components/review/use-media";
import { codeSource, effectiveCodeTime, lineCount, textAt, type TypingMode } from "./code-state.ts";
import type { VoiceSegment } from "./demo-clock.ts";
import {
  PHASE_SHORT,
  SPEEDS,
  buildCues,
  captionIndexAt,
  chapterIndexAt,
  coverageTimes,
  cuesToTranscript,
  fmtClock,
  demoKeyAction,
  nextChapterStart,
  nextCueStart,
  prevChapterStart,
  prevCueStart,
  roundSeek,
  runAt,
  seekPoints,
  sliderKeyAction,
  speedLabel,
  stepIndexAt,
  stepSpeed,
  verdictView,
  type DemoKeyAction,
} from "./demo-model.ts";
import { DemoEditor } from "./DemoEditor";
import { ChapterList } from "./ChapterList";
import { RunPanel } from "./RunPanel";
import { CaptionText, ChapterIcon, PauseIcon, PlayIcon, SentenceIcon, SpeakerIcon } from "./parts.tsx";
import { useDemoClock } from "./use-demo-clock.ts";
import type { DemoProblemInfo, DemoUserRecord } from "./types.ts";

/**
 * 模範解答デモのプレイヤー（01 §4.2・§5・§6）。単一の時計（DemoClock）で 字幕・音声・コード・実行・章 を同期する。
 *
 * レイアウト（レビュー画面のワークスペースと同じ考え方 ReviewScreen.tsx）:
 * - 1280px 以上: 1 画面の高さ。上段に操作部と全幅のタイムライン、下段に 章・問題文 / コード＋字幕 / 実行結果・字幕の全文 の 3 列
 * - 1280px 未満: 操作部・タイムライン・字幕を sticky にし、コード / 実行 / 章 / 字幕 / 問題文 をタブで切り替える
 * フォーカスの順は 操作部 → タイムライン → 字幕 → コード → 左の列 → 右の列（01 §7）。
 *
 * キー（01 §6）: Space 再生/停止、←/→ 前/次の文、j/k 次/前の章、Home/End 先頭/最終コード、> < 速度、m 消音、? 一覧。
 * タイムラインのスライダー上では ←/→ を文、PageUp/PageDown を章に読み替える。
 * シーク: ドラッグ中はその時刻ちょうどのコードを出し、離したらその時刻以前の最も近い区切りに丸めて続ける（01 §3）。
 */

type MobileTab = "code" | "run" | "chapters" | "captions" | "statement";
const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: "code", label: "コード" },
  { id: "run", label: "実行" },
  { id: "chapters", label: "章" },
  { id: "captions", label: "字幕" },
  { id: "statement", label: "問題文" },
];
type LeftTab = "chapters" | "statement";
const LEFT_TABS: { id: LeftTab; label: string }[] = [
  { id: "chapters", label: "章・ポイント" },
  { id: "statement", label: "問題文" },
];

const PREF_KEY = "lci:demo:prefs";
interface Prefs {
  speed?: number;
  typing?: TypingMode;
  muted?: boolean;
}
function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPrefs(), ...p }));
  } catch {
    /* 保存できなくても再生には関係ない */
  }
}

export function DemoPlayer({
  problem,
  detail,
  record,
  audioEnabled,
  initialChapter,
  onRate,
  banners,
}: {
  problem: DemoProblemInfo;
  detail: DemoDetail;
  record: DemoUserRecord;
  /** 音声を鳴らすか（音声があり、合成済み）。false なら字幕だけで進める（FR-D-53） */
  audioEnabled: boolean;
  /** URL の chapter（phase か章 id）。そこから始める（レビューの「方針宣言から見る」） */
  initialChapter?: string | null;
  onRate: () => void;
  /** 音声の状態などのバナー（ワークスペースの上に出す） */
  banners?: ReactNode;
}) {
  const demo = detail.compiled;
  const cues = useMemo(() => buildCues(demo), [demo]);
  const transcript = useMemo(() => cuesToTranscript(cues), [cues]);
  const points = useMemo(() => seekPoints(demo, cues), [demo, cues]);
  const src = useMemo(() => codeSource(demo), [demo]);
  const coverage = useMemo(() => coverageTimes(demo.steps), [demo]);
  const runSteps = useMemo(() => demo.steps.filter((s) => s.run), [demo]);
  const pins = useMemo(() => eventPins(demo.events), [demo]);
  const files = useMemo(() => [{ file_id: demo.file.file_id, path: demo.file.path, language: demo.file.language }], [demo]);
  const segments = useMemo<VoiceSegment[]>(() => {
    if (!audioEnabled || !detail.audio) return [];
    return demo.steps.flatMap((s) => (s.say?.audio_key ? [{ key: s.say.audio_key, stepId: s.id, t0: s.say.t0, t1: s.say.t1, url: detail.audio_url_template.replace("{key}", s.say.audio_key) }] : []));
  }, [audioEnabled, detail, demo]);
  const startT = useMemo(() => {
    if (!initialChapter) return 0;
    const ch = demo.chapters.find((c) => c.id === initialChapter || c.phase === initialChapter);
    return ch?.t0 ?? 0;
  }, [demo, initialChapter]);

  // 表示の設定（速度・演出・消音）は閲覧者ごとの好みとして覚える。prefers-reduced-motion なら「まとめて」が既定（FR-D-13）
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  const [prefs] = useState<Prefs>(() => (typeof window === "undefined" ? {} : readPrefs()));
  const [typingChoice, setTypingChoice] = useState<TypingMode | null>(prefs.typing ?? null);
  const typing: TypingMode = typingChoice ?? (reducedMotion ? "group" : "char");

  const { clock, state } = useDemoClock({ duration: demo.duration, segments, initialT: startT, rate: prefs.speed ?? 1, muted: prefs.muted ?? false });
  const t = state.t;

  // ---- 導出 ----------------------------------------------------------------
  const stepIdx = stepIndexAt(demo.steps, t);
  const step = demo.steps[stepIdx] ?? null;
  const chapterIdx = chapterIndexAt(demo.chapters, t);
  const chapter = demo.chapters[chapterIdx] ?? null;
  const capIdx = captionIndexAt(cues, t);
  const cap = cues[capIdx] ?? null;
  const run = runAt(demo.steps, t);
  const effT = effectiveCodeTime(demo.steps, t, typing);
  const typingActive = !!step?.typing && effT >= step.typing.t0;
  const editorStep = useMemo(
    () => (step ? { t0: step.t0, base: demo.keyframes[`kf:${step.id}`] ?? "", typing: typingActive, highlight: step.highlight?.range } : null),
    [step, demo.keyframes, typingActive],
  );
  const sec = Math.floor(t / 1000);
  const codeLabel = `${fmtT(sec * 1000)} 時点のデモのコード（読み取り専用）`;
  const lines = useMemo(() => lineCount(textAt(src, effT).text), [src, effT]);
  const bands = useMemo(
    () => ({ label: "章", items: demo.chapters.map((c, i) => ({ id: c.id, t0: c.t0, t1: c.t1, label: c.title, short: PHASE_SHORT[c.phase], current: i === chapterIdx })) }),
    [demo.chapters, chapterIdx],
  );
  const ended = state.ended || t >= demo.duration;

  // ---- 操作 ----------------------------------------------------------------
  const [announce, setAnnounce] = useState("");
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("code");
  const [leftTab, setLeftTab] = useState<LeftTab>("chapters");
  const [helpOpen, setHelpOpen] = useState(false);

  const seek = useCallback((nt: number) => clock.seek(nt), [clock]);
  const seekChapter = useCallback(
    (i: number) => {
      const c = demo.chapters[i];
      if (!c) return;
      clock.seek(c.t0);
      setAnnounce(`${i + 1} ${c.title} ${fmtT(c.t0)} から`);
    },
    [clock, demo.chapters],
  );
  const setSpeed = useCallback(
    (s: number) => {
      clock.setRate(s);
      writePrefs({ speed: s });
    },
    [clock],
  );
  const setMuted = useCallback(
    (m: boolean) => {
      clock.setMuted(m);
      writePrefs({ muted: m });
    },
    [clock],
  );
  const setTyping = useCallback((m: TypingMode) => {
    setTypingChoice(m);
    writePrefs({ typing: m });
  }, []);

  const doAction = useCallback(
    (a: DemoKeyAction) => {
      const cur = clock.getState().t;
      switch (a) {
        case "toggle":
          clock.toggle();
          return;
        case "prevSentence":
          clock.seek(prevCueStart(cues, cur));
          return;
        case "nextSentence": {
          const n = nextCueStart(cues, cur);
          if (n != null) clock.seek(n);
          return;
        }
        case "prevChapter": {
          const nt = prevChapterStart(demo.chapters, cur);
          seekChapter(chapterIndexAt(demo.chapters, nt));
          return;
        }
        case "nextChapter": {
          const nt = nextChapterStart(demo.chapters, cur);
          if (nt != null) seekChapter(chapterIndexAt(demo.chapters, nt));
          return;
        }
        case "start":
          clock.seek(0);
          return;
        case "end":
          clock.pause();
          clock.seek(demo.duration);
          return;
        case "faster":
          setSpeed(stepSpeed(clock.getState().rate, 1));
          return;
        case "slower":
          setSpeed(stepSpeed(clock.getState().rate, -1));
          return;
        case "mute":
          setMuted(!clock.getState().muted);
          return;
        case "help":
          setHelpOpen(true);
          return;
      }
    },
    [clock, cues, demo.chapters, demo.duration, seekChapter, setSpeed, setMuted, setHelpOpen],
  );

  // グローバルのキー（入力欄・Monaco・ダイアログでは奪わない）
  const actionRef = useRef(doAction);
  useEffect(() => {
    actionRef.current = doAction;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("dialog")) return;
      const a = demoKeyAction(
        e.key,
        {
          tag: el?.tagName ?? "BODY",
          role: el?.getAttribute("role") ?? null,
          editable: !!el?.isContentEditable,
          inEditor: !!el?.closest(".monaco-editor"),
          inArrowWidget: !!el?.closest('[role="toolbar"],[role="tablist"],[role="slider"],[role="radiogroup"]') || (el?.tagName === "INPUT" && (el as HTMLInputElement).type === "radio"),
        },
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (!a) return;
      e.preventDefault();
      actionRef.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // タイムラインのスライダー: 矢印を「文」、PageUp/PageDown を「章」に読み替える（CodeTimeline の ±5 秒より先に取る）
  const onTimelineKeyCapture = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.getAttribute("role") !== "slider" || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = sliderKeyAction(e.key);
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    doAction(a);
  };
  // ドラッグ: 押している間は止めてその時刻ちょうどを出し、離したら区切りに丸めて続ける
  const scrub = useRef<{ wasPlaying: boolean } | null>(null);
  const onTimelinePointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (e.button !== 0 || el.getAttribute("role") !== "slider") return;
    scrub.current = { wasPlaying: clock.getState().playing };
    clock.pause();
  };
  const endScrub = () => {
    const s = scrub.current;
    if (!s) return;
    scrub.current = null;
    clock.seek(roundTo(clock.getState().t));
    if (s.wasPlaying) clock.play();
  };
  /** 区切りに丸める。終端（End・右端）は丸めずに最終コードを出す */
  const roundTo = useCallback((nt: number) => (nt >= demo.duration - 1 ? demo.duration : roundSeek(nt, points)), [demo.duration, points]);
  const onTimelineSeek = useCallback((nt: number) => clock.seek(scrub.current ? nt : roundTo(nt)), [clock, roundTo]);
  const onSelectPin = useCallback(
    (id: string) => {
      const p = pins.find((x) => x.id === id);
      if (!p) return;
      clock.seek(p.t);
      if (!isWide) setMobileTab("run");
    },
    [clock, pins, isWide],
  );

  // ---- タブ（モバイル）と左の列のタブ ---------------------------------------------
  const mobileTabs = useTabs({ count: MOBILE_TABS.length, selectedIndex: MOBILE_TABS.findIndex((x) => x.id === mobileTab), onSelectedIndexChange: (i) => setMobileTab(MOBILE_TABS[i]!.id) });
  const leftTabs = useTabs({ count: LEFT_TABS.length, selectedIndex: LEFT_TABS.findIndex((x) => x.id === leftTab), onSelectedIndexChange: (i) => setLeftTab(LEFT_TABS[i]!.id) });
  /** モバイルではタブのパネルとして読ませる（xl では左の列のタブか、普通の領域） */
  const paneProps = (id: MobileTab) => {
    const li = LEFT_TABS.findIndex((x) => x.id === id);
    const p = isWide ? (li >= 0 ? leftTabs.getPanelProps(li) : null) : mobileTabs.getPanelProps(MOBILE_TABS.findIndex((x) => x.id === id));
    return p ? { id: p.id, role: p.role, "aria-labelledby": p["aria-labelledby"], tabIndex: -1 } : {};
  };
  const paneHidden = (id: MobileTab) => cx(mobileTab !== id && "max-xl:hidden", (id === "chapters" || id === "statement") && leftTab !== id && "xl:hidden");

  const speedNote = state.rate > 1.25;

  // 再生を始めたら、ワークスペースが画面に収まるようにする（ヘッダやバナーの下に隠れたままにしない。レビュー画面と同じ判定）
  const workspaceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!state.playing) return;
    const el = workspaceRef.current;
    if (el && needsReveal(el.getBoundingClientRect(), window.innerHeight)) el.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  }, [state.playing, reducedMotion]);

  return (
    <div className="flex flex-col gap-4">
      {banners}
      <span role="status" className="sr-only">
        {announce}
      </span>

      <section
        ref={workspaceRef}
        aria-label="デモの再生"
        className={cx(
          "flex flex-col gap-3",
          "scroll-mt-2 xl:grid xl:h-[calc(100dvh-16px)] xl:min-h-[640px] xl:grid-rows-[auto_auto_minmax(0,1fr)_auto]",
          "xl:grid-cols-[minmax(260px,3fr)_minmax(460px,6fr)_minmax(300px,3fr)]",
          "xl:[grid-template-areas:'bar_bar_bar'_'tl_tl_tl'_'left_code_right'_'left_cap_right']",
        )}
      >
        {/* モバイルでは sticky のプレイヤー。xl では中身をグリッドに直接並べる（contents） */}
        <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-border bg-canvas px-4 pt-2 pb-2 desktop:-mx-6 desktop:px-6 xl:contents">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 xl:[grid-area:bar]">
            <Button onClick={() => clock.toggle()} aria-keyshortcuts="Space" icon={state.playing ? <PauseIcon /> : <PlayIcon />} variant="secondary" className="min-w-[6.5rem]">
              {state.playing ? "一時停止" : ended ? "最初から" : "再生"}
            </Button>
            <span className="inline-flex items-center gap-1">
              <IconButton label="前の文（←）" variant="secondary" onClick={() => doAction("prevSentence")} aria-keyshortcuts="ArrowLeft">
                <SentenceIcon dir={-1} />
              </IconButton>
              <IconButton label="次の文（→）" variant="secondary" onClick={() => doAction("nextSentence")} aria-keyshortcuts="ArrowRight">
                <SentenceIcon dir={1} />
              </IconButton>
            </span>
            <span className="inline-flex items-center gap-1">
              <IconButton label="前の章（k）" onClick={() => doAction("prevChapter")} aria-keyshortcuts="k">
                <ChapterIcon dir={-1} />
              </IconButton>
              <IconButton label="次の章（j）" onClick={() => doAction("nextChapter")} aria-keyshortcuts="j">
                <ChapterIcon dir={1} />
              </IconButton>
            </span>
            <span className="text-mono-14N-150 text-fg" aria-live="off">
              {fmtClock(t)} <span className="text-fg-muted">/ {fmtT(demo.duration)}</span>
            </span>
            <label className="ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-dns-13N-130 text-fg-muted">
              速度
              <Select
                value={String(state.rate)}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-[5.25rem]"
                aria-describedby={speedNote ? "demo-speed-note" : undefined}
                aria-keyshortcuts="Shift+Period Shift+Comma"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={String(s)}>
                    {speedLabel(s)}
                  </option>
                ))}
              </Select>
            </label>
            {speedNote && (
              <span id="demo-speed-note" className="text-dns-13N-130 text-fg-muted">
                字幕で追える目安は 1.25x まで
              </span>
            )}
            <IconButton
              label={!segments.length ? "音声がありません" : state.muted ? "消音を解除（m）" : "消音（m）"}
              variant="secondary"
              pressed={state.muted}
              disabled={!segments.length}
              onClick={() => setMuted(!state.muted)}
              aria-keyshortcuts="m"
            >
              <SpeakerIcon muted={state.muted || !segments.length} />
            </IconButton>
            <fieldset className="m-0 flex min-w-0 items-center gap-x-3 border-0 p-0">
              <legend className="sr-only">タイプ演出</legend>
              <span aria-hidden className="text-dns-13N-130 text-fg-muted">
                演出
              </span>
              <Radio name="demo-typing" checked={typing === "char"} onChange={() => setTyping("char")}>
                文字ごと
              </Radio>
              <Radio name="demo-typing" checked={typing === "group"} onChange={() => setTyping("group")}>
                まとめて
              </Radio>
            </fieldset>
            <span className="ml-auto hidden items-center gap-1.5 text-dns-13N-130 text-fg-muted xl:flex">
              <Kbd>Space</Kbd> 再生
              <span className="ml-2 inline-flex gap-0.5">
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
              </span>
              文
              <span className="ml-2 inline-flex gap-0.5">
                <Kbd>j</Kbd>
                <Kbd>k</Kbd>
              </span>
              章
            </span>
            <Button size="xs" variant="tertiary" onClick={() => setHelpOpen(true)} aria-keyshortcuts="Shift+Slash" className="max-sm:hidden max-xl:ml-auto">
              <Kbd>?</Kbd> キー操作
            </Button>
          </div>

          <div
            className="rounded-8 border border-border bg-surface px-3 py-2 xl:[grid-area:tl]"
            onKeyDownCapture={onTimelineKeyCapture}
            onPointerDownCapture={onTimelinePointerDownCapture}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onLostPointerCapture={endScrub}
          >
            <CodeTimeline
              events={demo.events}
              files={files}
              transcript={transcript}
              metrics={null}
              duration={demo.duration}
              t={t}
              pins={[]}
              eventPins={pins}
              selectedPinId={null}
              feedbackAxis={EMPTY_AXIS}
              onSeek={onTimelineSeek}
              onSelectPin={onSelectPin}
              onTogglePlay={() => clock.toggle()}
              bands={bands}
            />
          </div>

          {/* 字幕（今の文を 2 行まで。FR-D-12）。終わったら終了カード（FR-D-18） */}
          <div className="xl:[grid-area:cap]">
            {ended ? (
              <EndCard problemId={problem.id} sessionId={record.latestSessionId} onReplay={() => clock.play()} onRate={onRate} />
            ) : (
              <div className="flex min-h-[4.75rem] items-start gap-3 rounded-8 border border-border bg-surface px-4 py-2.5" aria-live="off">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-dns-13N-130 text-fg-muted">
                    {chapter ? chapter.title : ""}
                    {state.waiting && <span className="ml-2">音声を読み込み中…</span>}
                    {state.voiceFailures > 0 && <span className="ml-2">（音声を再生できなかった文は字幕だけで進めています）</span>}
                  </span>
                  <p className="line-clamp-2 text-std-16N-170 text-fg">{cap ? <CaptionText text={cap.text} /> : <span className="text-fg-muted">再生すると、ここに字幕が出ます。</span>}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* モバイルのタブ（xl では出さない） */}
        <div {...(!isWide ? mobileTabs.getListProps("表示するペイン") : {})} className={cx(tabListClass, "xl:hidden")}>
          {MOBILE_TABS.map((m, i) => (
            <button key={m.id} {...(!isWide ? mobileTabs.getTabProps(i) : { type: "button" as const, onClick: () => setMobileTab(m.id) })} className={cx(tabClass, "text-dns-14N-130")}>
              {m.label}
            </button>
          ))}
        </div>

        {/* コード */}
        <div {...paneProps("code")} className={cx(paneHidden("code"), "flex min-h-0 flex-col overflow-hidden rounded-8 border border-border bg-surface max-xl:h-[64dvh] xl:[grid-area:code]")}>
          <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1">
            <h2 className="text-mono-13N-150 text-fg">{demo.file.path}</h2>
            <span className="text-dns-13N-130 text-fg-muted tabular-nums">
              {fmtT(sec * 1000)} 時点 · {lines} 行
            </span>
            {run && run.step.id === step?.id && (
              <span className="ml-auto">
                {run.phase === "running" ? (
                  <StatusBadge>実行中…</StatusBadge>
                ) : (
                  <StatusBadge tone={toneOf(run.result.verdict)}>
                    {run.result.verdict} {run.result.total > 0 ? `${run.result.passed}/${run.result.total}` : ""}
                  </StatusBadge>
                )}
              </span>
            )}
          </div>
          <DemoEditor src={src} language={demo.file.language} t={effT} step={editorStep} showSelection={typing === "char"} label={codeLabel} className="flex-1" />
        </div>

        {/* 左の列: 章・ポイント / 問題文 */}
        <div className="flex min-h-0 flex-col max-xl:contents xl:overflow-hidden xl:rounded-8 xl:border xl:border-border xl:bg-surface xl:[grid-area:left]">
          <div {...(isWide ? leftTabs.getListProps("左の列") : {})} className={cx(tabListClass, "hidden px-1 xl:flex")}>
            {LEFT_TABS.map((m, i) => (
              <button key={m.id} {...(isWide ? leftTabs.getTabProps(i) : { type: "button" as const, onClick: () => setLeftTab(m.id) })} className={cx(tabClass, "text-dns-14N-130")}>
                {m.label}
              </button>
            ))}
          </div>
          <div {...paneProps("chapters")} className={cx(paneHidden("chapters"), "min-h-0 flex-1 max-xl:h-[64dvh] max-xl:rounded-8 max-xl:border max-xl:border-border max-xl:bg-surface max-xl:overflow-y-auto")}>
            <ChapterList chapters={demo.chapters} currentIndex={chapterIdx} t={t} talkingPoints={problem.talking_points} coverage={coverage} onSeekChapter={seekChapter} onSeek={seek} className="h-full p-1" />
          </div>
          <div {...paneProps("statement")} className={cx(paneHidden("statement"), "min-h-0 flex-1 overflow-y-auto p-3 max-xl:h-[64dvh] max-xl:rounded-8 max-xl:border max-xl:border-border max-xl:bg-surface")}>
            <h3 className="sr-only">問題文</h3>
            <div className="text-std-14N-170 text-fg-body">
              <Markdown text={problem.statement} />
            </div>
            {problem.constraints && (
              <div className="mt-4 flex flex-col gap-2">
                <h4 className="text-dns-14B-130 text-fg">制約</h4>
                <div className="text-std-14N-170 text-fg-body">
                  <Markdown text={problem.constraints} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右の列: 実行結果（上）と字幕の全文（下） */}
        <div className="flex min-h-0 flex-col gap-3 max-xl:contents xl:[grid-area:right]">
          <section aria-label="実行結果" {...paneProps("run")} className={cx(paneHidden("run"), "flex min-h-0 flex-col overflow-hidden rounded-8 border border-border bg-surface max-xl:h-[64dvh] xl:max-h-[48%] xl:shrink-0")}>
            <h2 className="border-b border-border px-3 py-2 text-dns-14B-130 text-fg">実行結果</h2>
            <RunPanel run={run} runs={runSteps} samples={problem.samples} script={detail.script} onSeek={seek} className="min-h-0 flex-1" />
          </section>
          <div {...paneProps("captions")} className={cx(paneHidden("captions"), "min-h-0 max-xl:h-[64dvh] xl:flex-1")}>
            <TranscriptPane transcript={transcript} stt={undefined} status="ready" t={t} onSeek={seek} highlight={null} title="字幕の全文" countLabel="文" renderText={(text) => <CaptionText text={text} />} className="h-full" />
          </div>
        </div>
      </section>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen} title="キー操作" width={440}>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 pb-1">
          {HELP.map(([k, d]) => (
            <div key={d} className="contents">
              <dt className="flex gap-0.5">
                {k.map((x) => (
                  <Kbd key={x}>{x}</Kbd>
                ))}
              </dt>
              <dd className="m-0 text-dns-14N-130 text-fg-body">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-dns-13N-130 text-fg-muted">タイムラインにフォーカスがあるときは、←/→ で文、PageUp/PageDown で章を移動します。</p>
      </Dialog>
    </div>
  );
}

const EMPTY_AXIS = new Map();

const HELP: [string[], string][] = [
  [["Space"], "再生 / 一時停止"],
  [["←", "→"], "前 / 次の文（文の頭から 1.5 秒以上たっていれば ← は今の文の頭）"],
  [["j", "k"], "次 / 前の章"],
  [["Home", "End"], "先頭 / 最終コード"],
  [[">", "<"], "速度を 1 段上げる / 下げる"],
  [["m"], "消音の切り替え"],
  [["?"], "この一覧"],
];

function toneOf(v: string): "success" | "warning" | "danger" | "neutral" {
  const t = verdictView(v as Parameters<typeof verdictView>[0]).tone;
  return t === "info" ? "neutral" : t;
}

/** 終了カード（FR-D-18）。主ボタンは「もう一度解く」 */
function EndCard({ problemId, sessionId, onReplay, onRate }: { problemId: string; sessionId: string | null; onReplay: () => void; onRate: () => void }) {
  return (
    <section aria-labelledby="demo-end-h" className="flex flex-col gap-2 rounded-8 border border-border-strong bg-surface px-4 py-3">
      <h2 id="demo-end-h" className="text-dns-16B-130 text-fg">
        デモはここまでです
      </h2>
      <p className="text-std-14N-170 text-fg-body">理想化した進行です。本番ではこの 1.3〜1.5 倍かかっても構いません。違いを確かめたら、もう一度自分で解いてみましょう。</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <LinkButton href={`/problems/${problemId}`} variant="primary">
          もう一度解く
        </LinkButton>
        {sessionId && <LinkButton href={`/sessions/${sessionId}`}>自分のセッションと比べる</LinkButton>}
        <Button onClick={onRate}>評価する</Button>
        <Button variant="tertiary" onClick={onReplay}>
          最初から再生
        </Button>
      </div>
    </section>
  );
}
