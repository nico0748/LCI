"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtT, type Axis, type Evaluation, type Evidence, type FeedbackItem } from "@lci/core/browser";
import { VideoPane } from "./VideoPane";
import { TranscriptPane } from "./TranscriptPane";
import { CodeTimeline } from "./CodeTimeline";
import { CodeAtT, type CodeHighlight } from "./CodeAtT";
import { EvaluationPanel } from "./EvaluationPanel";
import { clamp, sessionDuration } from "./time";
import { eventPins, feedbackPins, nextPin, normalizeEvalTimes, prevPin, sortPins } from "./pins";
import type { ReviewProblemInfo, TimelineData } from "./types";

/**
 * S5 レビュー画面の状態管理。
 * 単一の時刻 t を主キーにして、動画・文字起こし・タイムライン・コード・ピンを同期する（FR-U-13）。
 * - seek は `seekVersion` を進めて動画に伝える。動画からの時刻報告は t だけを更新する（ループ防止）
 * - 動画が無いセッションは内部クロックで再生する
 * - finalizing 中は 5 秒ごとに timeline と evaluations を再取得する
 * キー: Space 再生/停止、←/→ ±5 秒、j/k 前後のピン
 */
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
  const [selectedAxis, setSelectedAxis] = useState<Axis | null>(null);
  const [highlight, setHighlight] = useState<CodeHighlight | null>(null);
  const [transcriptHl, setTranscriptHl] = useState<{ t0: number; t1: number } | null>(null);

  const { session, events, transcript, metrics } = data;
  const duration = useMemo(
    () => sessionDuration({ ended_t: session.ended_t, lastEventT: events.length ? events[events.length - 1]!.t : undefined, recorders: session.recorders }),
    [session.ended_t, session.recorders, events],
  );
  const evaluations = useMemo(() => rawEvaluations.map((e) => normalizeEvalTimes(e, duration)), [rawEvaluations, duration]);
  const evaluation = evaluations[evalIndex] ?? null;

  // ファイル一覧: session.files に無くても file_open イベントから補う
  const files = useMemo(() => {
    const list = [...session.files];
    for (const e of events) {
      if (e.type === "file_open" && !list.some((f) => f.file_id === e.file)) list.push({ file_id: e.file, path: e.file, language: e.language });
    }
    return list;
  }, [session.files, events]);
  const [file, setFile] = useState<string | null>(null);
  useEffect(() => {
    if (!file && files[0]) setFile(files[0].file_id);
  }, [files, file]);

  const pins = useMemo(() => sortPins([...feedbackPins(evaluation), ...eventPins(events)]), [evaluation, events]);
  const jumpPins = useMemo(() => {
    const fb = pins.filter((p) => p.kind === "feedback");
    return fb.length ? fb : pins;
  }, [pins]);

  // seek（ユーザー操作）。ピン由来でない seek はコードのピン固定を解除する
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
        if (evs) setRawEvaluations(evs);
      } catch {
        /* 次の周期で再試行 */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [status, sessionId]);

  // ピン選択
  const selectFeedback = useCallback(
    (f: FeedbackItem) => {
      setSelectedPinId(f.id);
      setSelectedAxis(f.axis);
      if (f.code_ref) {
        setHighlight(f.code_ref);
        setFile(f.code_ref.file);
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
      const p = pins.find((x) => x.id === id);
      if (p) {
        setSelectedPinId(p.id);
        seek(p.t);
      }
    },
    [evaluation, pins, selectFeedback, seek],
  );
  const onCodeRef = useCallback(
    (ref: CodeHighlight) => {
      setHighlight(ref);
      setFile(ref.file);
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
          break;
        case "edit":
          if (e.lines) {
            setHighlight({ file: e.file, lines: e.lines, at: e.t });
            setFile(e.file);
          } else setFile(e.file);
          seek(e.t, { keepHighlight: true });
          break;
        case "frame":
          seek(e.t);
          break;
        case "run": {
          const ev = events.find((x) => x.type === "run" && x.run_id === e.run_id);
          if (ev) seek(ev.t);
          break;
        }
        case "metric": {
          if (e.name === "silence_gt15s" && e.index != null && metrics?.silence_gt15s[e.index]) seek(metrics.silence_gt15s[e.index]!.t0);
          else if (e.name === "run_events" && e.index != null && metrics?.run_events[e.index]) seek(metrics.run_events[e.index]!.t);
          else if (e.name === "direction_changes" && e.index != null && metrics?.direction_changes[e.index]) seek(metrics.direction_changes[e.index]!.t);
          break;
        }
        case "edit_absence":
          break;
      }
    },
    [seek, events, metrics],
  );

  // キーボード
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (el?.closest(".monaco-editor")) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          setPlaying((p) => !p);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(tRef.current - 5000);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(tRef.current + 5000);
          break;
        case "j": {
          const p = nextPin(jumpPins, tRef.current);
          if (p) selectPinById(p.id);
          break;
        }
        case "k": {
          const p = prevPin(jumpPins, tRef.current);
          if (p) selectPinById(p.id);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seek, jumpPins, selectPinById]);

  const notReady = status !== "ready" && status !== "failed";

  return (
    <div className="space-y-3">
      {notReady && (
        <div className="rounded-lg border border-warn/50 bg-bg-elev px-3 py-2 text-xs flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-warn" aria-hidden />
          セッションを処理中です（{status}）。録画の再 mux・文字起こし・指標計算が終わると自動で更新されます（5 秒ごとに確認）。
        </div>
      )}
      {status === "failed" && (
        <div className="rounded-lg border border-danger/50 bg-bg-elev px-3 py-2 text-xs">
          セッションの後処理に失敗しました。残っている録画・ログの範囲で振り返れます。
          {session.warnings.length > 0 && <span className="font-mono ml-1">{session.warnings.map((w) => w.code).join(", ")}</span>}
        </div>
      )}

      {/* トランスポート＋スクラバ */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded-md border border-border bg-bg-elev px-3 py-1 font-mono hover:border-accent" aria-label={playing ? "停止" : "再生"}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={() => seek(t - 5000)} className="rounded-md border border-border bg-bg-elev px-2 py-1 text-xs hover:border-accent" aria-label="5 秒戻る">
            −5s
          </button>
          <button type="button" onClick={() => seek(t + 5000)} className="rounded-md border border-border bg-bg-elev px-2 py-1 text-xs hover:border-accent" aria-label="5 秒進む">
            +5s
          </button>
          <span className="font-mono tabular-nums">
            {fmtT(t)} <span className="text-fg-muted">/ {fmtT(duration)}</span>
          </span>
          <span className="ml-auto text-[11px] text-fg-muted hidden md:inline">
            Space 再生/停止 · ←/→ ±5s · j/k 前後のピン{jumpPins.length ? `（${jumpPins.length}）` : ""}
          </span>
        </div>
        <CodeTimeline
          events={events}
          files={files}
          transcript={transcript}
          silences={metrics?.silence_gt15s}
          duration={duration}
          t={t}
          pins={pins}
          selectedPinId={selectedPinId}
          onSeek={seek}
          onSelectPin={selectPinById}
        />
      </div>

      {/* 3 カラム: 動画＋文字起こし / コード / 評価 */}
      <div className="grid gap-3 xl:grid-cols-[minmax(300px,1fr)_minmax(380px,1.4fr)_minmax(340px,1.1fr)]">
        <div className="space-y-3 min-w-0">
          <VideoPane sessionId={sessionId} recorders={session.recorders} t={t} seekVersion={seekVersion} playing={playing} onTime={onVideoTime} onPlayingChange={setPlaying} onMediaAvailable={onMediaAvailable} />
          <TranscriptPane transcript={transcript} stt={session.stt} status={status} t={t} onSeek={seek} highlight={transcriptHl} />
        </div>
        <div className="min-w-0">
          <CodeAtT sessionId={sessionId} files={files} file={file} onFileChange={setFile} t={t} highlight={highlight} onClearHighlight={() => setHighlight(null)} />
        </div>
        <div className="min-w-0">
          <EvaluationPanel
            sessionId={sessionId}
            session={session}
            problem={problem}
            metrics={metrics}
            duration={duration}
            evaluations={evaluations}
            index={evalIndex}
            onIndexChange={setEvalIndex}
            onEvaluationsChange={setRawEvaluations}
            selectedPinId={selectedPinId}
            onSelectFeedback={selectFeedback}
            onSeek={seek}
            onEvidence={onEvidence}
            onCodeRef={onCodeRef}
            selectedAxis={selectedAxis}
            onSelectAxis={setSelectedAxis}
          />
        </div>
      </div>
    </div>
  );
}
