"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtT, type Axis, type Evaluation, type Evidence, type FeedbackItem } from "@lci/core/browser";
import { Button, IconButton, Kbd, NotificationBanner, cx, tabClass, tabListClass, useTabs } from "@/components/ui";
import { VideoPane } from "./VideoPane";
import { TranscriptPane } from "./TranscriptPane";
import { CodeTimeline } from "./CodeTimeline";
import { CodeAtT, type CodeHighlight } from "./CodeAtT";
import { FeedbackList } from "./FeedbackList";
import { TimelineTable } from "./TimelineTable";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewDetails } from "./ReviewDetails";
import { ReviewNotes } from "./ReviewNotes";
import { clamp, fmtTFine, sessionDuration } from "./time";
import { eventPins as toEventPins, feedbackPins, nextPin, normalizeEvalTimes, prevPin } from "./pins";
import { metricTime, numberFeedback } from "./review-model";
import { needsReveal, shortcutAllowed } from "./timeline-layout";
import { WIDE_QUERY, useMediaQuery } from "./use-media";
import type { ReviewProblemInfo, TimelineData } from "./types";

/**
 * S5 レビュー画面の状態管理とレイアウト（04 §2.2 案 C）。
 * 単一の時刻 t を主キーにして、動画・文字起こし・タイムライン・コード・指摘を同期する（FR-U-13）。
 *
 * レイアウト:
 * - 上から サマリ（総評・次の練習・要件・軸）→ 再生ワークスペース → 軸別の根拠・指標 → 解説
 * - 1280px 以上: ワークスペースは 1 画面の高さ（100dvh − ヘッダ 56 − フッタ 40）。上段に全幅のタイムライン、
 *   下段に 動画＋文字起こし / コード / 指摘 の 3 列。各列は内部でスクロールするので、同期先が画面から流れない
 * - 1280px 未満: トランスポート・動画・タイムラインを sticky にし、文字起こし / コード / 指摘はタブで切り替える
 * - ワークスペースの外（サマリ・詳細）から seek するときは、先にワークスペースを画面に入れる（S1-1）
 *
 * キー: Space 再生/停止、←/→ ±5 秒、j/k 前後の指摘（ボタン・タブ・スライダー上では奪わない、S2-5）
 * 処理: seek は `seekVersion` を進めて動画に伝える。動画からの時刻報告は t だけを更新する（ループ防止）。
 * 動画が無いセッションは内部クロックで再生する。finalizing 中は 5 秒ごとに timeline と evaluations を再取得する。
 */

type MobileTab = "list" | "transcript" | "code";

export function ReviewScreen({
  sessionId,
  initial,
  problem,
  initialEvaluations,
}: {
  sessionId: string;
  initial: TimelineData;
  problem: ReviewProblemInfo | null;
  initialEvaluations: Evaluation[];
}) {
  const [data, setData] = useState<TimelineData>(initial);
  const [rawEvaluations, setRawEvaluations] = useState<Evaluation[]>(initialEvaluations);
  const [evalIndex, setEvalIndex] = useState(Math.max(0, initialEvaluations.length - 1));
  const [t, setT] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasMedia, setHasMedia] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<CodeHighlight | null>(null);
  const [transcriptHl, setTranscriptHl] = useState<{ t0: number; t1: number } | null>(null);
  const [openAxes, setOpenAxes] = useState<Set<Axis>>(() => new Set());
  const [tableOpen, setTableOpen] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const workspaceRef = useRef<HTMLElement>(null);

  const { session, events, transcript, metrics } = data;
  const duration = useMemo(
    () => sessionDuration({ ended_t: session.ended_t, lastEventT: events.length ? events[events.length - 1]!.t : undefined, recorders: session.recorders }),
    [session.ended_t, session.recorders, events],
  );
  const evaluations = useMemo(() => rawEvaluations.map((e) => normalizeEvalTimes(e, duration)), [rawEvaluations, duration]);
  const evaluation = evaluations[evalIndex] ?? null;
  const numbers = useMemo(() => numberFeedback(evaluation?.feedback ?? []), [evaluation]);
  const feedbackAxis = useMemo(() => new Map((evaluation?.feedback ?? []).map((f) => [f.id, f.axis])), [evaluation]);

  // ファイル一覧: session.files に無くても file_open イベントから補う
  const files = useMemo(() => {
    const list = [...session.files];
    for (const e of events) {
      if (e.type === "file_open" && !list.some((f) => f.file_id === e.file)) list.push({ file_id: e.file, path: e.file, language: e.language });
    }
    return list;
  }, [session.files, events]);
  const [fileSel, setFileSel] = useState<string | null>(null);
  const file = fileSel ?? files[0]?.file_id ?? null;

  const pins = useMemo(() => feedbackPins(evaluation, numbers).sort((a, b) => a.t - b.t), [evaluation, numbers]);
  const evPins = useMemo(() => toEventPins(events), [events]);
  const jumpPins = pins.length ? pins : evPins;

  // モバイルのタブ（評価が無ければ指摘タブを出さない）
  const tabIds: MobileTab[] = evaluation ? ["list", "transcript", "code"] : ["transcript", "code"];
  const [mobileTab, setMobileTab] = useState<MobileTab>(evaluation ? "list" : "transcript");
  const activeTab = tabIds.includes(mobileTab) ? mobileTab : tabIds[0]!;
  const tabs = useTabs({ count: tabIds.length, selectedIndex: tabIds.indexOf(activeTab), onSelectedIndexChange: (i) => setMobileTab(tabIds[i]!) });

  // seek（ユーザー操作）。ピン由来でない seek はコードの固定と根拠のハイライトを解除する
  const seek = useCallback(
    (nt: number, opts?: { keepHighlight?: boolean }) => {
      setT(clamp(nt, 0, duration));
      setSeekVersion((v) => v + 1);
      if (!opts?.keepHighlight) {
        setHighlight(null);
        setTranscriptHl(null);
      }
    },
    [duration],
  );
  const onVideoTime = useCallback((nt: number) => setT(nt), []);
  const onMediaAvailable = useCallback((ok: boolean) => setHasMedia(ok), []);

  /** ワークスペースの外からの操作: 同期先を画面に入れ、モバイルでは該当するタブを開く */
  const reveal = useCallback(
    (tab?: MobileTab) => {
      if (tab && !isWide) setMobileTab(tab);
      const el = workspaceRef.current;
      if (!el) return;
      if (needsReveal(el.getBoundingClientRect(), window.innerHeight)) el.scrollIntoView({ block: "start" });
    },
    [isWide],
  );

  // 動画が無いときの内部クロック
  useEffect(() => {
    if (!playing || hasMedia) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((cur) => {
        const next = cur + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, hasMedia, duration]);

  // finalizing 中のポーリング
  const status = session.status;
  useEffect(() => {
    if (status === "ready" || status === "failed") return;
    const id = setInterval(async () => {
      try {
        const [tl, evs] = await Promise.all([
          fetch(`/api/sessions/${encodeURIComponent(sessionId)}/timeline`).then((r) => (r.ok ? (r.json() as Promise<TimelineData>) : null)),
          fetch(`/api/sessions/${encodeURIComponent(sessionId)}/evaluations`).then((r) => (r.ok ? (r.json() as Promise<Evaluation[]>) : null)),
        ]);
        if (tl) setData(tl);
        if (evs) {
          setRawEvaluations(evs);
          setEvalIndex((i) => (evs.length && i >= evs.length ? evs.length - 1 : i));
        }
      } catch {
        /* 次の周期で再試行 */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [status, sessionId]);

  // 指摘の選択（ワークスペース内）
  const selectFeedback = useCallback(
    (f: FeedbackItem) => {
      setSelectedPinId(f.id);
      if (f.code_ref) {
        setHighlight(f.code_ref);
        setFileSel(f.code_ref.file);
      } else setHighlight(null);
      const tr = f.evidence.find((e) => e.type === "transcript");
      setTranscriptHl(tr && tr.type === "transcript" ? { t0: tr.t0, t1: tr.t1 } : f.t_end != null ? { t0: f.t, t1: f.t_end } : null);
      seek(f.t, { keepHighlight: true });
    },
    [seek],
  );
  const selectPinById = useCallback(
    (id: string) => {
      const f = evaluation?.feedback.find((x) => x.id === id);
      if (f) return selectFeedback(f);
      const p = evPins.find((x) => x.id === id);
      if (p) {
        setSelectedPinId(p.id);
        seek(p.t);
      }
    },
    [evaluation, evPins, selectFeedback, seek],
  );
  const onCodeRef = useCallback(
    (ref: CodeHighlight) => {
      setHighlight(ref);
      setFileSel(ref.file);
      seek(ref.at, { keepHighlight: true });
    },
    [seek],
  );
  const onEvidence = useCallback(
    (e: Evidence) => {
      switch (e.type) {
        case "transcript":
          setTranscriptHl({ t0: e.t0, t1: e.t1 });
          seek(e.t0, { keepHighlight: true });
          return "transcript" as const;
        case "edit":
          if (e.lines) setHighlight({ file: e.file, lines: e.lines, at: e.t });
          setFileSel(e.file);
          seek(e.t, { keepHighlight: true });
          return "code" as const;
        case "frame":
          seek(e.t);
          return undefined;
        case "run": {
          const ev = events.find((x) => x.type === "run" && x.run_id === e.run_id);
          if (ev) seek(ev.t);
          return undefined;
        }
        case "metric": {
          const mt = metricTime(e, metrics);
          if (mt != null) seek(mt);
          return undefined;
        }
        case "edit_absence":
          return undefined;
      }
    },
    [seek, events, metrics],
  );

  // ワークスペースの外から呼ぶ版（先に画面に入れる）
  const outside = {
    selectFeedback: (f: FeedbackItem) => {
      reveal("list");
      selectFeedback(f);
    },
    codeRef: (ref: CodeHighlight) => {
      reveal("code");
      onCodeRef(ref);
    },
    seekTranscript: (tt: number) => {
      reveal("transcript");
      setTranscriptHl({ t0: tt, t1: tt + 1 });
      seek(tt, { keepHighlight: true });
    },
    seek: (tt: number) => {
      reveal();
      seek(tt);
    },
    evidence: (e: Evidence) => {
      const tab = e.type === "transcript" ? "transcript" : e.type === "edit" ? "code" : undefined;
      reveal(tab);
      onEvidence(e);
    },
  };

  const openAxis = useCallback((a: Axis) => {
    setOpenAxes((s) => new Set(s).add(a));
    // 開いてから位置を合わせる（details の中身が描かれた後）
    requestAnimationFrame(() => {
      const el = document.getElementById(`axis-${a}`);
      el?.scrollIntoView({ block: "start" });
      el?.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    });
  }, []);
  const toggleAxis = useCallback((a: Axis, open: boolean) => {
    setOpenAxes((s) => {
      if (s.has(a) === open) return s;
      const n = new Set(s);
      if (open) n.add(a);
      else n.delete(a);
      return n;
    });
  }, []);

  // キーボード（最新の t と操作は ref 経由で読む）
  const live = useRef({ t, seek, jumpPins, selectPinById, reveal });
  useEffect(() => {
    live.current = { t, seek, jumpPins, selectPinById, reveal };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("dialog")) return;
      const allowed = shortcutAllowed(
        e.key,
        {
          tag: el?.tagName ?? "BODY",
          role: el?.getAttribute("role") ?? null,
          editable: !!el?.isContentEditable,
          inEditor: !!el?.closest(".monaco-editor"),
          inArrowWidget: !!el?.closest('[role="toolbar"],[role="tablist"],[role="slider"]'),
        },
        e.ctrlKey || e.metaKey || e.altKey,
      );
      if (!allowed) return;
      const L = live.current;
      switch (e.key) {
        case " ":
          e.preventDefault();
          setPlaying((p) => !p);
          break;
        case "ArrowLeft":
          e.preventDefault();
          L.seek(L.t - 5000);
          break;
        case "ArrowRight":
          e.preventDefault();
          L.seek(L.t + 5000);
          break;
        case "j":
        case "k": {
          const p = e.key === "j" ? nextPin(L.jumpPins, L.t) : prevPin(L.jumpPins, L.t);
          if (p) {
            L.reveal("list");
            L.selectPinById(p.id);
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notReady = status !== "ready" && status !== "failed";
  const hasEval = !!evaluation;
  /** モバイルではタブのパネルとして読ませる（xl では普通の領域）。非表示はクラスで切り替える */
  const paneProps = (id: MobileTab) => {
    const i = tabIds.indexOf(id);
    if (isWide || i < 0) return {};
    const p = tabs.getPanelProps(i);
    return { id: p.id, role: p.role, "aria-labelledby": p["aria-labelledby"], tabIndex: -1 };
  };
  const paneHidden = (id: MobileTab) => id !== activeTab && "max-xl:hidden";

  return (
    <div className="flex flex-col gap-8">
      {notReady && (
        <NotificationBanner tone="info" title="セッションを処理中です" live="off">
          録画の再 mux・文字起こし・指標の計算が終わると、この画面は自動で更新されます（5 秒ごとに確認。状態: <span className="text-mono-13N-150">{status}</span>）。
        </NotificationBanner>
      )}
      {status === "failed" && (
        <NotificationBanner tone="danger" title="後処理に失敗しました" live="off">
          残っている録画・ログの範囲で振り返れます。
          {session.warnings.length > 0 && <span className="ml-1 text-mono-13N-150">{session.warnings.map((w) => w.code).join(", ")}</span>}
        </NotificationBanner>
      )}

      <ReviewSummary
        sessionId={sessionId}
        session={session}
        metrics={metrics}
        evaluations={evaluations}
        index={evalIndex}
        onIndexChange={setEvalIndex}
        onEvaluationsChange={(list, i) => {
          setRawEvaluations(list);
          setEvalIndex(Math.max(0, i));
        }}
        numbers={numbers}
        onSelectFeedback={outside.selectFeedback}
        onCodeRef={outside.codeRef}
        onSeekTranscript={outside.seekTranscript}
        onSeek={outside.seek}
        onOpenAxis={openAxis}
      />

      {/* 再生ワークスペース */}
      <section
        ref={workspaceRef}
        aria-labelledby="review-ws-h"
        className={cx(
          "flex scroll-mt-2 flex-col gap-3",
          "xl:grid xl:h-[calc(100dvh-96px)] xl:min-h-[600px] xl:grid-rows-[auto_auto_auto_minmax(0,1fr)]",
          hasEval
            ? "xl:grid-cols-[minmax(300px,4fr)_minmax(420px,5fr)_minmax(300px,3fr)] xl:[grid-template-areas:'bar_bar_bar'_'tl_tl_tl'_'video_code_list'_'tr_code_list']"
            : "xl:grid-cols-[minmax(320px,5fr)_minmax(480px,7fr)] xl:[grid-template-areas:'bar_bar'_'tl_tl'_'video_code'_'tr_code']",
        )}
      >
        {/* モバイルでは sticky のプレイヤー。xl では中身をグリッドに直接並べる（contents） */}
        <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-border bg-canvas px-4 pt-2 pb-2 desktop:-mx-6 desktop:px-6 xl:contents">
          <div className="flex flex-wrap items-center gap-2 xl:[grid-area:bar]">
            <h2 id="review-ws-h" className="sr-only xl:not-sr-only xl:mr-2 xl:text-dns-16B-130 xl:text-fg">
              再生とタイムライン
            </h2>
            <Button onClick={() => setPlaying((p) => !p)} aria-keyshortcuts="Space" icon={playing ? <PauseIcon /> : <PlayIcon />} className="xl:min-w-[6.5rem]">
              {playing ? "一時停止" : "再生"}
            </Button>
            <IconButton label="5 秒戻る（←）" variant="secondary" onClick={() => seek(t - 5000)} aria-keyshortcuts="ArrowLeft">
              <SkipIcon dir={-1} />
            </IconButton>
            <IconButton label="5 秒進む（→）" variant="secondary" onClick={() => seek(t + 5000)} aria-keyshortcuts="ArrowRight">
              <SkipIcon dir={1} />
            </IconButton>
            <span className="text-mono-14N-150 text-fg" aria-live="off">
              {fmtTFine(t)} <span className="text-fg-muted">/ {fmtT(duration)}</span>
            </span>
            {hasMedia && (
              <IconButton label={videoHidden ? "映像を出す" : "映像を隠す"} variant="secondary" pressed={!videoHidden} className="ml-auto xl:hidden" onClick={() => setVideoHidden((v) => !v)}>
                <VideoIcon />
              </IconButton>
            )}
            <span className="ml-auto hidden items-center gap-1.5 text-dns-13N-130 text-fg-muted xl:flex">
              <Kbd>Space</Kbd> 再生
              <span className="ml-2 inline-flex gap-0.5">
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
              </span>
              5 秒
              {jumpPins.length > 0 && (
                <>
                  <span className="ml-2 inline-flex gap-0.5">
                    <Kbd>j</Kbd>
                    <Kbd>k</Kbd>
                  </span>
                  前後の{pins.length ? "指摘" : "出来事"}
                </>
              )}
            </span>
          </div>
          <div className={cx("xl:[grid-area:video]", videoHidden && "max-xl:hidden")}>
            <VideoPane
              sessionId={sessionId}
              recorders={session.recorders}
              t={t}
              seekVersion={seekVersion}
              playing={playing}
              onTime={onVideoTime}
              onPlayingChange={setPlaying}
              onMediaAvailable={onMediaAvailable}
              className="max-xl:[&_.aspect-video]:mx-auto max-xl:[&_.aspect-video]:max-h-[24dvh]"
            />
          </div>
          <div className="rounded-8 border border-border bg-surface px-3 py-2 xl:[grid-area:tl]">
            <CodeTimeline
              events={events}
              files={files}
              transcript={transcript}
              metrics={metrics}
              duration={duration}
              t={t}
              pins={pins}
              eventPins={evPins}
              selectedPinId={selectedPinId}
              feedbackAxis={feedbackAxis}
              onSeek={seek}
              onSelectPin={selectPinById}
              onOpenTable={() => setTableOpen(true)}
              onTogglePlay={() => setPlaying((p) => !p)}
            />
          </div>
        </div>

        {/* モバイルのタブ（xl では出さない） */}
        <div {...(!isWide ? tabs.getListProps("表示するペイン") : {})} className={cx(tabListClass, "xl:hidden")}>
          {tabIds.map((id, i) => (
            <button key={id} {...(!isWide ? tabs.getTabProps(i) : { type: "button" as const, onClick: () => setMobileTab(id) })} className={cx(tabClass, "text-dns-14N-130")}>
              {id === "list" ? `指摘 ${evaluation?.feedback.length ?? 0}` : id === "transcript" ? "文字起こし" : "コード"}
            </button>
          ))}
        </div>

        <div {...paneProps("transcript")} className={cx(paneHidden("transcript"), "min-h-0 max-xl:h-[60dvh] xl:[grid-area:tr]")}>
          <TranscriptPane transcript={transcript} stt={session.stt} status={status} t={t} onSeek={seek} highlight={transcriptHl} className="h-full" />
        </div>
        <div {...paneProps("code")} className={cx(paneHidden("code"), "min-h-0 max-xl:h-[60dvh] xl:[grid-area:code]")}>
          <CodeAtT sessionId={sessionId} files={files} file={file} onFileChange={setFileSel} t={t} highlight={highlight} onClearHighlight={() => setHighlight(null)} className="h-full" />
        </div>
        {hasEval && (
          <div {...paneProps("list")} className={cx(paneHidden("list"), "min-h-0 max-xl:h-[60dvh] xl:[grid-area:list]")}>
            <FeedbackList
              feedback={evaluation.feedback}
              numbers={numbers}
              selectedId={selectedPinId}
              metrics={metrics}
              onSelect={selectFeedback}
              onEvidence={onEvidence}
              onCodeRef={onCodeRef}
              className="h-full"
            />
          </div>
        )}
      </section>

      <ReviewDetails
        ev={evaluation}
        problem={problem}
        metrics={metrics}
        numbers={numbers}
        openAxes={openAxes}
        onToggleAxis={toggleAxis}
        onEvidence={outside.evidence}
        onSelectFeedback={outside.selectFeedback}
        onSeek={outside.seek}
      />

      {problem && <ReviewNotes problemId={problem.id} language={session.problem.language} />}

      <TimelineTable open={tableOpen} onOpenChange={setTableOpen} pins={pins} eventPins={evPins} metrics={metrics} onSelectPin={selectPinById} onSeek={seek} />
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
      <path d="M4.5 2.8v10.4L13 8Z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
      <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
    </svg>
  );
}
/** 5 秒戻る / 進む（二重の三角＋縦線） */
function SkipIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" style={dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M2.5 3.5v9L8 8Zm5.5 0v9L13.5 8Z" fill="currentColor" />
      <path d="M14 3.5v9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
/** 映像の表示切替（カメラの形） */
function VideoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
      <rect x="1.5" y="4" width="9" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 7 4-2.2v6.4l-4-2.2Z" fill="currentColor" />
    </svg>
  );
}
